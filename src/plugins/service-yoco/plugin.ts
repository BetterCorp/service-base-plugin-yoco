import { CPlugin, CPluginClient, IPlugin } from '@bettercorp/service-base/lib/interfaces/plugins';
import { Tools } from '@bettercorp/tools/lib/Tools';
import { YocoDefaults, YocoGetSecret, YocoPaymentCompleteData, YocoPaymentFailedData, YocoPaymentRequest, YocoPaymentResult, YocoPluginConfig, YocoPluginEvents, YocoSourcePluginEvents } from '../../lib';
import AXIOS from 'axios';
import { AxiosResponse as AResponse } from 'axios';
import * as crypto from 'crypto';
import * as FS from 'fs';
import * as PATH from 'path';
import { eAndD } from './eAndD';
import { fastify } from '@bettercorp/service-base-plugin-web-server/lib/plugins/fastify/fastify';

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

    async startPaymentRequest(request: YocoPaymentRequest): Promise<any> {
        request.data.sourcePluginName = this._refPluginName;
        return this.emitEventAndReturn(YocoPluginEvents.makePaymentRequest, request);
    }

    async onGetSecret(listener: (request?: YocoGetSecret) => Promise<string>) {
        await this.refPlugin.onReturnableEvent<YocoGetSecret, string>(this._refPluginName, YocoSourcePluginEvents.getSecret, listener);
    }

    async onPaymentComplete(listener: { (response: YocoPaymentCompleteData): Promise<void>; }) {
        await this.refPlugin.onEvent(this._refPluginName, YocoSourcePluginEvents.paymentComplete, listener);
    }
}

export class Plugin extends CPlugin<YocoPluginConfig> {
    fastify!: fastify;
    private getYocoUrl(action: string): string {
        return `${ YocoDefaults.url }${ YocoDefaults.version }/${ action }/`;
    }
    public init(): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            self.fastify = new fastify(self);

            self.onReturnableEvent(null, YocoPluginEvents.ping, (data) => new Promise(async (resolve, reject) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                AXIOS.post<any>(self.getYocoUrl('charges'), {}, {
                    headers: {
                        'X-Auth-Secret-Key': (await self.getPluginConfig()).sandboxConfig.secretKey
                    }
                }).then(x => {
                    resolve(x.status === 400 && x.data.errorType === 'invalid_request_error');
                }).catch(x => {
                    self.log.error(x);
                    resolve(false);
                });
            }));
            self.onReturnableEvent(null, YocoPluginEvents.makePaymentRequest, (data) => new Promise(async (resolve, reject) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                let merchantConfig = (await self.getPluginConfig()).sandboxConfig;
                if (data.client.live === true) {
                    merchantConfig.publicKey = data.client.publicKey;
                    merchantConfig.secretKey = data.client.secretKey;
                }
                try {
                    let amountInCents = Number.parseInt((data.data.amount * 100).toFixed(0));
                    let workingObj = {
                        live: data.client.live,
                        time: new Date().getTime(),
                        timeExpiry: new Date().getTime() + (1000 * 60 * 60),
                        publicKey: merchantConfig.publicKey,
                        returnUrl: data.data.returnUrl,
                        cancelUrl: data.data.cancelUrl,
                        paymentReference: data.data.paymentReference,
                        paymentInternalReference: data.data.paymentInternalReference,
                        additionalData: data.data.additionalData,
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
                    let requestKey = await eAndD.encrypt(self, JSON.stringify(workingObj));
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
                        url: `${ (await self.getPluginConfig()).myHost }/Yoco/Start?ref=${ encodeURIComponent(requestKey) }`,
                        request: {
                            live: data.client.live,
                            time: new Date().getTime(),
                            timeExpiry: 0,
                            publicKey: merchantConfig.publicKey,
                            returnUrl: data.data.returnUrl,
                            cancelUrl: data.data.cancelUrl,
                            paymentReference: data.data.paymentReference,
                            paymentInternalReference: data.data.paymentInternalReference,
                            additionalData: data.data.additionalData,
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
            }));
            resolve();
        });
    }
    public readonly loadedIndex: number = 999995;
    public loaded(): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            self.log.debug(`loaded`);
            self.fastify.get<any, any, any>('/Yoco/Start', async (req, res) => {
                try {
                    /*const cipherText = Buffer.from(decodeURIComponent(req.query.ref), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                    let decrypted = await eAndD.decrypt(self, decodeURIComponent(req.query.ref));
                    let data = JSON.parse(decrypted);
                    let now = new Date().getTime();
                    if (now >= data.timeExpiry)
                        throw 'Time expired!';
                    let content = FS.readFileSync(PATH.join(self.cwd, './node_modules/@bettercorp/service-base-plugin-yoco/content/yoco/index.html')).toString();
                    let variablesToClient = {
                        url: (await self.getPluginConfig()).myHost + '/Yoco/Start',
                        ref: req.query.ref,
                        amountFormatted: data.amountFormatted,
                        amountCents: data.amountInCents,
                        currency: data.currency,
                        publicKey: data.publicKey,
                        description: data.paymentReference,
                        metadata: {
                            internalReference: data.paymentInternalReference,
                            additionalData: data.additionalData
                        },
                        customer: {
                            email: data.email,
                            phone: data.cell,
                            firstName: data.firstName,
                            lastName: data.lastName
                        }
                    };
                    content = content.replace('{{VARIABLES}}', JSON.stringify(variablesToClient));
                    res.header('content-type', 'text/html');
                    res.send(content);
                }
                catch (xcc) {
                    self.log.error(xcc);
                    res.status(400).send('An unknown error occurred');
                }
            });
            self.log.debug(`loaded`);
            self.fastify.post<any, any, any>('/Yoco/Start', async (req, res): Promise<any> => {
                try {
                    /*const cipherText = Buffer.from(decodeURIComponent(req.query.ref), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                    let reqData = req.body;
                    let decrypted = await eAndD.decrypt(self, decodeURIComponent(reqData.ref));
                    let data = JSON.parse(decrypted);

                    let now = new Date().getTime();
                    if (now >= data.timeExpiry)
                        throw 'Time expired!';

                    let secretKey = await this.emitEventAndReturn<YocoGetSecret, string | null | undefined>(data.notifyService, YocoSourcePluginEvents.getSecret, {
                        publicKey: data.publicKey,
                        paymentReference: data.paymentReference,
                        paymentInternalReference: data.paymentInternalReference
                    });

                    if (Tools.isNullOrUndefined(secretKey)) {
                        self.log.error('UNABLE TO GET SECRET FROM SRC');
                        return res.status(500).send({ status: false, message: 'Unable to verify payment request' });
                    }

                    AXIOS.post<any>(self.getYocoUrl('charges'), {
                        token: reqData.id,
                        amountInCents: data.amountInCents,
                        currency: data.currency
                    }, {
                        headers: {
                            'X-Auth-Secret-Key': secretKey!
                        }
                    }).then((x: AResponse<YocoPaymentResult | YocoPaymentFailedData, any>): any | void => {
                        if (x.status === 201) {
                            self.emitEvent<YocoPaymentCompleteData>(data.notifyService, YocoSourcePluginEvents.paymentComplete, {
                                live: data.live,
                                publicKey: data.publicKey,
                                amount: data.amountInCents,
                                paymentReference: data.paymentReference,
                                paymentInternalReference: data.paymentInternalReference,
                                additionalData: data.additionalData,
                                currency: data.currency,
                                firstName: data.firstName,
                                lastName: data.lastName,
                                email: data.email,
                                cell: data.cell,
                                payment: {
                                    req: reqData,
                                    res: (x.data as YocoPaymentResult)
                                }
                            });
                            return res.status(201).send({
                                status: (x.data as YocoPaymentResult).status === 'successful',
                                reference: data.paymentReference,
                                internalReference: data.paymentInternalReference
                            });
                        }
                        self.log.error(x.data);
                        res.status(500).send({ status: false, message: (x.data as YocoPaymentFailedData).displayMessage });
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
