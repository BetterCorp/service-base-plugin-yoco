import { SecConfig } from "@bettercorp/service-base";
import * as crypto from "crypto";

export interface YocoPluginConfig {
  myHost: string; // My Host: like https://example.com
  commsToken: string; // Comms Token: ** Special encryption token
  commsTokenIV: string; // Comms Token IV: ** Special encryption token
  sandboxConfig: YocoSandboxConfig; // Sandbox Config: Default/test config
}
export interface YocoSandboxConfig {
  publicKey: string; // Public Key
  secretKey: string; // Secret Key
}

export class Config extends SecConfig<YocoPluginConfig> {
  migrate(
    mappedPluginName: string,
    existingConfig: YocoPluginConfig
  ): YocoPluginConfig {
    return {
      myHost:
        existingConfig.myHost !== undefined
          ? existingConfig.myHost
          : "http://localhost",
      commsToken:
        existingConfig.commsToken !== undefined
          ? existingConfig.commsToken
          : crypto.randomBytes(64).toString("hex").substring(2, 34), // 32
      commsTokenIV:
        existingConfig.commsTokenIV !== undefined
          ? existingConfig.commsTokenIV
          : crypto.randomBytes(16).toString("hex"), // 16
      sandboxConfig: {
        publicKey:
          existingConfig.sandboxConfig !== undefined &&
          existingConfig.sandboxConfig.publicKey !== undefined
            ? existingConfig.sandboxConfig.publicKey
            : "pk_test_ed3c54a6gOol69qa7f45",
        secretKey:
          existingConfig.sandboxConfig !== undefined &&
          existingConfig.sandboxConfig.secretKey !== undefined
            ? existingConfig.sandboxConfig.secretKey
            : "sk_test_960bfde0VBrLlpK098e4ffeb53e1",
      },
    };
  }
}
