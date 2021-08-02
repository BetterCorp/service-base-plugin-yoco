import { CPlugin } from '@bettercorp/service-base/lib/ILib';
import * as crypto from 'crypto';

export class eAndD {
  private static readonly algorithm: string = 'aes-256-ctr';
  static encrypt(self: CPlugin, text: string) {

    const cipher = crypto.createCipheriv(this.algorithm, self.getPluginConfig().commsToken, Buffer.from(self.getPluginConfig().commsTokenIV, 'hex'));

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex');
  }
  static decrypt(self: CPlugin, hash: string) {

    const decipher = crypto.createDecipheriv(this.algorithm, self.getPluginConfig().commsToken, Buffer.from(self.getPluginConfig().commsTokenIV, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash, 'hex')), decipher.final()]);

    return decrpyted.toString();
  }
}