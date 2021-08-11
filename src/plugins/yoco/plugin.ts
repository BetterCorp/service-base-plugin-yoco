import { CPlugin, CPluginClient, IPlugin } from '@bettercorp/service-base/lib/ILib';
import { Tools } from '@bettercorp/tools/lib/Tools';
import { YocoDefaults, YocoPluginConfig, YocoPluginEvents, YocoSourcePluginEvents } from '../../lib';
import { Request as ERequest, Response as EResponse } from 'express';
import AXIOS from 'axios';
import { AxiosResponse as AResponse } from 'axios';
import * as crypto from 'crypto';
import * as FS from 'fs';
import * as PATH from 'path';
import { eAndD } from './eAndD';
import * as EXPRESS from 'express';
import { express } from '@bettercorp/service-base-plugin-web-server/lib/plugins/express/express';

export type PromiseResolve<TData = any, TReturn = void> = (data: TData) => TReturn;
export class yoco extends CPluginClient<any> {
  public readonly _pluginName: string = "yoco";
  private _refPluginName: string;
  constructor(self: IPlugin) {
    super(self);
    this._refPluginName = this.refPlugin.pluginName;
  }

  async ping(): Promise<boolean> {
    return this.emitEventAndReturn(YocoPluginEvents.ping);
  }

  async startPaymentRequest(request: any): Promise<any> {
    request.data.sourcePluginName = this._refPluginName;
    return this.emitEventAndReturn(YocoPluginEvents.makePaymentRequest, request);
  }

  async onPaymentComplete(listener: (response: any) => void) {
    this.refPlugin.onEvent(this._refPluginName, YocoSourcePluginEvents.paymentComplete, listener as any);
  }
}

export class Plugin extends CPlugin<YocoPluginConfig> {
    express!: express;
    private getYocoUrl(action: string): string {
        return `${ YocoDefaults.url }${ YocoDefaults.version }/${ action }/`;
    }
    public init(): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            self.express = new express(self);
            self.express.use(async (req: any, res: any, next: Function) => {
                self.log.debug(`REQ[${ req.method }] ${ req.path } (${ JSON.stringify(req.query) })`);
                res.setHeader('Access-Control-Allow-Headers', '*');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', '*');

                if (req.method.toUpperCase() === 'OPTIONS')
                    return res.sendStatus(200);

                next();
            });
            self.log.info('USE JSON FOR EXPRESS');
            self.express.use(EXPRESS.json({ limit: '5mb' }));

            self.onReturnableEvent(null, YocoPluginEvents.ping, (resolve, reject, data) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                AXIOS.post(self.getYocoUrl('charges'), {}, {
                    headers: {
                        'X-Auth-Secret-Key': self.getPluginConfig().sandboxConfig.secretKey
                    }
                }).then(x => {
                    resolve(x.status === 400 && x.data.errorType === 'invalid_request_error');
                }).catch(x => {
                    self.log.error(x);
                    resolve(false);
                });
            });
            self.onReturnableEvent(null, YocoPluginEvents.makePaymentRequest, (resolve, reject, data) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                let merchantConfig = self.getPluginConfig().sandboxConfig;
                if (data.client.live === true) {
                    merchantConfig.publicKey = data.client.publicKey;
                    merchantConfig.secretKey = data.client.secretKey;
                }
                try {
                    let amountInCents = Number.parseInt((data.data.amount * 100).toFixed(0));
                    let workingObj = {
                        time: new Date().getTime(),
                        timeExpiry: new Date().getTime() + (1000 * 60 * 60),
                        publicKey: merchantConfig.publicKey,
                        secretKey: merchantConfig.secretKey,
                        returnUrl: data.data.returnUrl,
                        cancelUrl: data.data.cancelUrl,
                        paymentReference: data.data.paymentReference,
                        paymentInternalReference: data.data.paymentInternalReference,
                        currency: data.data.currency,
                        symbol: data.data.symbol,
                        amount: data.data.amount,
                        amountFormatted: Tools.formatCurrency(data.data.amount, 2, '.', ' ', data.data.symbol),
                        firstName: data.data.firstName,
                        lastName: data.data.lastName,
                        email: data.data.email,
                        cell: data.data.cell,
                        amountInCents: amountInCents,
                        random: crypto.randomBytes(Math.floor((Math.random() * 100) + 1)).toString('hex'),
                        notifyService: data.data.sourcePluginName
                    };
                    /*let requestCipher = crypto.createCipheriv('aes-256-ccm', Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let requestKey = Buffer.concat([requestCipher.update(JSON.stringify(workingObj)), requestCipher.final()]).toString('base64');*/
                    let requestKey = eAndD.encrypt(self, JSON.stringify(workingObj));
                    /*let key: any = {
                      char1: Math.floor((Math.random() * 5) + 1),
                      char2: Math.floor((Math.random() * 5) + 1) + 5,
                    }
                    key = {
                      char1R: requestKey[key.char1],
                      char2R: requestKey[key.char2],
                    }
                    requestKey[key.char1] = `${Math.floor((Math.random() * 9) + 1)}`[0];
                    requestKey[key.char2] = `${Math.floor((Math.random() * 9) + 1)}`[0];*/
                    return resolve({
                        url: `${ self.getPluginConfig().myHost }/Yoco/${ encodeURIComponent(requestKey) }`,
                        request: {
                            time: new Date().getTime(),
                            timeExpiry: 0,
                            publicKey: merchantConfig.publicKey,
                            secretKey: '',
                            returnUrl: data.data.returnUrl,
                            cancelUrl: data.data.cancelUrl,
                            paymentReference: data.data.paymentReference,
                            paymentInternalReference: data.data.paymentInternalReference,
                            currency: data.data.currency,
                            symbol: data.data.symbol,
                            amount: data.data.amount,
                            amountFormatted: Tools.formatCurrency(data.data.amount, 2, '.', ' ', data.data.symbol),
                            firstName: data.data.firstName,
                            lastName: data.data.lastName,
                            email: data.data.email,
                            cell: data.data.cell,
                            amountInCents: amountInCents,
                            random: '',
                            notifyService: data.data.sourcePluginName
                        }
                    });
                }
                catch (erc) {
                    self.log.error(erc);
                    return reject(erc);
                }
            });
            resolve();
        });
    }
    public readonly loadedIndex: number = 999995;
    public loaded(): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            self.log.debug(`loaded`);
            self.express.get('/Yoco/:token', (req: ERequest, res: EResponse) => {
                try {
                    /*const cipherText = Buffer.from(decodeURIComponent(req.params.token), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                    let decrypted = eAndD.decrypt(self, decodeURIComponent(req.params.token));
                    let data = JSON.parse(decrypted);
                    let now = new Date().getTime();
                    if (now >= data.timeExpiry)
                        throw 'Time expired!';
                    let content = FS.readFileSync(PATH.join(self.cwd, './node_modules/@bettercorp/service-base-plugin-yoco/lib/plugins/yoco/content/index.html')).toString();
                    let variablesToClient = {
                        url: self.getPluginConfig().myHost + '/Yoco/' + req.params.token,
                        amountFormatted: data.amountFormatted,
                        amountCents: data.amountInCents,
                        currency: data.currency,
                        publicKey: data.publicKey,
                        description: data.paymentReference,
                        metadata: {
                            internalReference: data.paymentInternalReference
                        },
                        customer: {
                            email: data.email,
                            phone: data.cell,
                            firstName: data.firstName,
                            lastName: data.lastName
                        }
                    };
                    content = content.replace('{{VARIABLES}}', JSON.stringify(variablesToClient));
                    res.setHeader('content-type', 'text/html');
                    res.send(content);
                }
                catch (xcc) {
                    self.log.error(xcc);
                    res.status(400).send('An unknown error occurred');
                }
            });
            self.log.debug(`loaded`);
            self.express.post('/Yoco/:token', (req: ERequest, res: EResponse) => {
                try {
                    /*const cipherText = Buffer.from(decodeURIComponent(req.params.token), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                    let decrypted = eAndD.decrypt(self, decodeURIComponent(req.params.token));
                    let data = JSON.parse(decrypted);
                    let reqData = req.body;
                    console.log(reqData);
                    let now = new Date().getTime();
                    if (now >= data.timeExpiry)
                        throw 'Time expired!';
                    self.log.debug(data);
                    AXIOS.post(self.getYocoUrl('charges'), {
                        token: reqData.id,
                        amountInCents: data.amountInCents,
                        currency: data.currency
                    }, {
                        headers: {
                            'X-Auth-Secret-Key': data.secretKey
                        }
                    }).then((x: AResponse): any | void => {
                        if (x.status === 201) {
                            self.emitEvent(data.notifyService, YocoSourcePluginEvents.paymentComplete, {
                                publicKey: data.publicKey,
                                amount: data.amountInCents,
                                paymentReference: data.paymentReference,
                                paymentInternalReference: data.paymentInternalReference,
                                currency: data.currency,
                                firstName: data.firstName,
                                lastName: data.lastName,
                                email: data.email,
                                cell: data.cell,
                                payment: {
                                    req: reqData,
                                    res: x.data
                                }
                            });
                            return res.status(201).send({
                                status: x.data.status === 'successful',
                                reference: data.paymentReference,
                                internalReference: data.paymentInternalReference
                            });
                        }
                        self.log.error(x.data);
                        res.status(500).send({ status: false, message: x.data.displayMessage });
                    }).catch(x => {
                        self.log.error(x.response.data);
                        res.status(500).send({ status: false, message: x.response.data.displayMessage });
                    });
                }
                catch (xcc) {
                    self.log.error(xcc);
                    res.status(400).send({ status: false, message: 'An unknown error occurred' });
                }
            });
            self.log.debug('YOCO READY');
            resolve();
        });
    };
}
