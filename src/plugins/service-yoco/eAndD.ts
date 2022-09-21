import * as crypto from 'crypto';

export class eAndD {
  private static readonly algorithm: string = 'aes-256-ctr';
  static async encrypt(commsToken: string, commsTokenIV: string, text: string) {

    const cipher = crypto.createCipheriv(this.algorithm, commsToken, Buffer.from(commsTokenIV, 'hex'));

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex');
  }
  static async decrypt(commsToken: string, commsTokenIV: string, hash: string) {

    const decipher = crypto.createDecipheriv(this.algorithm, commsToken, Buffer.from(commsTokenIV, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash, 'hex')), decipher.final()]);

    return decrpyted.toString();
  }
}