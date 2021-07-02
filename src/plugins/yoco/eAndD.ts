import { PluginFeature } from '@bettercorp/service-base/lib/ILib';
import * as crypto from 'crypto';
import { YocoPluginConfig } from '../../lib';

export class eAndD {
  private static readonly algorithm: string = 'aes-256-ctr';
  static encrypt(features: PluginFeature, text: string) {

    const cipher = crypto.createCipheriv(this.algorithm, features.getPluginConfig<YocoPluginConfig>().commsToken, Buffer.from(features.getPluginConfig<YocoPluginConfig>().commsTokenIV, 'hex'));

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex');
  }
  static decrypt(features: PluginFeature, hash: string) {

    const decipher = crypto.createDecipheriv(this.algorithm, features.getPluginConfig<YocoPluginConfig>().commsToken, Buffer.from(features.getPluginConfig<YocoPluginConfig>().commsTokenIV, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash, 'hex')), decipher.final()]);

    return decrpyted.toString();
  }
}