import { YocoPluginConfig } from '../../lib';
import * as crypto from 'crypto';

export default (): YocoPluginConfig => {
  return {
    myHost: 'http://localhost',
    commsToken: crypto.randomBytes(64).toString('hex').substring(2, 34), // 32
    commsTokenIV: crypto.randomBytes(16).toString('hex'), // 16
    sandboxConfig: {
      publicKey: 'pk_test_ed3c54a6gOol69qa7f45',
      secretKey: 'sk_test_960bfde0VBrLlpK098e4ffeb53e1',
    }
  };
};