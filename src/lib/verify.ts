import { SiweMessage } from "siwe";
import {
  hashMessage,
  recoverAddress,
  getAddress,
  isAddressEqual,
  isHex,
  createPublicClient,
  http,
  type PublicClient,
  type Hex,
} from "viem";
import { mainnet, sepolia } from "viem/chains";
import { getSiweConfig } from "../config/siwe";
import { nonceStore, type INonceStore } from "./nonce";

export const ERC1271_ABI = [
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
  },
] as const;

export const ERC1271_MAGIC_VALUE = "0x1626ba7e";

export interface VerifySiweParams {
  message: string | Record<string, any>;
  signature: string;
}

export interface VerifySiweOptions {
  nonceStore?: INonceStore;
  publicClient?: {
    readContract: (params: {
      address: `0x${string}`;
      abi: any;
      functionName: string;
      args: any[];
    }) => Promise<any>;
  };
  now?: Date;
}

export interface VerifySiweResult {
  success: boolean;
  address?: `0x${string}`;
  chainId?: number;
  error?: string;
}


function getDefaultPublicClient(chainId: number): PublicClient | undefined {
  const rpcUrl =
    process.env.RPC_URL ||
    (chainId === 1 ? process.env.RPC_URL_MAINNET : undefined) ||
    (chainId === 11155111 ? process.env.RPC_URL_SEPOLIA : undefined);

  if (chainId === 1) {
    return createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
  }

  if (chainId === 11155111) {
    return createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });
  }

  return undefined;
}


export async function verifySiweAuth(
  params: VerifySiweParams,
  options?: VerifySiweOptions
): Promise<VerifySiweResult> {
  
  if (!params || !params.message || !params.signature) {
    return {
      success: false,
      error: "Missing required parameters: 'message' and 'signature' are required",
    };
  }

  if (typeof params.signature !== "string" || !isHex(params.signature)) {
    return {
      success: false,
      error: "Invalid signature format: must be a hex string prefixed with 0x",
    };
  }

  
  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(params.message);
  } catch (err) {
    return {
      success: false,
      error: `Malformed SIWE message: ${err instanceof Error ? err.message : "Parse failure"}`,
    };
  }

 
  const config = getSiweConfig();
  if (siwe.domain !== config.domain) {
    return {
      success: false,
      error: `SIWE domain mismatch: expected '${config.domain}', received '${siwe.domain}'`,
    };
  }

  if (siwe.uri) {
    try {
      const parsedUri = new URL(siwe.uri);
      if (parsedUri.host !== config.domain) {
        return {
          success: false,
          error: `SIWE URI authority mismatch: expected host '${config.domain}', received '${parsedUri.host}'`,
        };
      }
    } catch {
      return {
        success: false,
        error: `Malformed SIWE URI: ${siwe.uri}`,
      };
    }
  }

  if (siwe.chainId !== config.chainId) {
    return {
      success: false,
      error: `SIWE chain ID mismatch: expected ${config.chainId}, received ${siwe.chainId}`,
    };
  }

  const currentTime = options?.now ? options.now.getTime() : Date.now();

  if (siwe.issuedAt) {
    const issuedAtTime = new Date(siwe.issuedAt).getTime();
    if (isNaN(issuedAtTime)) {
      return {
        success: false,
        error: "Invalid issuedAt format in SIWE message",
      };
    }
  }

  if (siwe.expirationTime) {
    const expirationTime = new Date(siwe.expirationTime).getTime();
    if (isNaN(expirationTime) || currentTime >= expirationTime) {
      return {
        success: false,
        error: isNaN(expirationTime) ? "Invalid expirationTime format in SIWE message" : "SIWE message has expired",
      };
    }
  }

  if (siwe.notBefore) {
    const notBeforeTime = new Date(siwe.notBefore).getTime();
    if (isNaN(notBeforeTime) || currentTime < notBeforeTime) {
      return {
        success: false,
        error: isNaN(notBeforeTime) ? "Invalid notBefore format in SIWE message" : "SIWE message is not yet valid (notBefore check failed)",
      };
    }
  }

  const store = options?.nonceStore ?? nonceStore;
  if (!store.isValid(siwe.nonce)) {
    return {
      success: false,
      error: "Invalid, expired, or unissued nonce",
    };
  }

 
  const preparedMessage = siwe.prepareMessage();
  const messageHash = hashMessage(preparedMessage);
  let targetAddress: `0x${string}`;

  try {
    targetAddress = getAddress(siwe.address);
  } catch {
    return {
      success: false,
      error: `Invalid address format in SIWE message: ${siwe.address}`,
    };
  }

  let isSignatureValid = false;

  
  try {
    const recoveredAddress = await recoverAddress({
      hash: messageHash,
      signature: params.signature as Hex,
    });

    if (isAddressEqual(recoveredAddress, targetAddress)) {
      isSignatureValid = true;
    }
  } catch {
    
  }

  
  if (!isSignatureValid) {
    const client = options?.publicClient ?? getDefaultPublicClient(siwe.chainId);
    if (client) {
      try {
        const magicValue = await client.readContract({
          address: targetAddress,
          abi: ERC1271_ABI,
          functionName: "isValidSignature",
          args: [messageHash, params.signature as Hex],
        });

        if (
          magicValue === ERC1271_MAGIC_VALUE ||
          (typeof magicValue === "string" && magicValue.toLowerCase() === ERC1271_MAGIC_VALUE.toLowerCase())
        ) {
          isSignatureValid = true;
        }
      } catch {
        
      }
    }
  }

  
  if (!isSignatureValid) {
    return {
      success: false,
      error: "Invalid cryptographic signature for the given SIWE message and address",
    };
  }

  
  const consumed = store.consume(siwe.nonce);
  if (!consumed) {
    return {
      success: false,
      error: "Nonce consumption failed: nonce was already consumed or expired",
    };
  }

 
  return {
    success: true,
    address: targetAddress,
    chainId: siwe.chainId,
  };
}
