import { IPlugin, PluginFeature } from '@bettercorp/service-base/lib/ILib';
import { Tools } from '@bettercorp/tools/lib/Tools';
import { YocoDefaults, YocoPluginEvents, YocoSourcePluginEvents } from '../../lib';
import { Request as ERequest, Response as EResponse } from 'express';
import AXIOS from 'axios';
import { AxiosResponse as AResponse } from 'axios';
import * as crypto from 'crypto';
import * as FS from 'fs';
import * as PATH from 'path';
import { eAndD } from './eAndD';
import * as EXPRESS from 'express';

export class Plugin implements IPlugin {
    private getYocoUrl(action: string): string {
        return `${ YocoDefaults.url }${ YocoDefaults.version }/${ action }/`;
    }
    public init(features: PluginFeature): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            features.initForPlugins('plugin-express', 'use', {
                arg1: async (req: any, res: any, next: Function) => {
                    features.log.debug(`REQ[${ req.method }] ${ req.path } (${ JSON.stringify(req.query) })`);
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', '*');

                    if (req.method.toUpperCase() === 'OPTIONS')
                        return res.sendStatus(200);

                    next();
                }
            });
            features.log.info('USE JSON FOR EXPRESS');
            features.initForPlugins('plugin-express', 'use', {
                arg1: EXPRESS.json({ limit: '5mb' })
            });

            features.onReturnableEvent(null, YocoPluginEvents.ping, (resolve, reject, data) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                AXIOS.post(self.getYocoUrl('charges'), {}, {
                    headers: {
                        'X-Auth-Secret-Key': features.getPluginConfig().sandboxConfig.secretKey
                    }
                }).then(x => {
                    resolve(x.status === 400 && x.data.errorType === 'invalid_request_error');
                }).catch(x => {
                    features.log.error(x);
                    resolve(false);
                });
            });
            features.onReturnableEvent(null, YocoPluginEvents.makePaymentRequest, (resolve, reject, data) => {
                if (Tools.isNullOrUndefined(data))
                    return reject('DATA UNDEFINED');
                let merchantConfig = features.getPluginConfig().sandboxConfig;
                if (data.client.live === true) {
                    merchantConfig.publicKey = data.client.publicKey;
                    merchantConfig.secretKey = data.client.secretKey;
                }
                try {
                    let amountInCents = Number.parseInt((data.data.amount * 100).toFixed(0))
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
                    let requestKey = eAndD.encrypt(features, JSON.stringify(workingObj));
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
                        url: `${ features.getPluginConfig().myHost }/Yoco/${ encodeURIComponent(requestKey) }`,
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
                    features.log.error(erc);
                    return reject(erc);
                }
            });
            resolve();
        });
    }
    public readonly loadedIndex: number = 999995;
    public loaded(features: PluginFeature): Promise<void> {
        const self = this;
        return new Promise((resolve) => {
            features.log.debug(`loaded`);
            features.initForPlugins('plugin-express', 'get', {
                arg1: '/Yoco/:token',
                arg2: (req: ERequest, res: EResponse) => {
                    try {
                        /*const cipherText = Buffer.from(decodeURIComponent(req.params.token), "base64");
                        const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                            authTagLength: 16
                        });
                        let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                        let decrypted = eAndD.decrypt(features, decodeURIComponent(req.params.token));
                        let data = JSON.parse(decrypted);
                        let now = new Date().getTime();
                        if (now >= data.timeExpiry)
                            throw 'Time expired!';
                        let content = FS.readFileSync(PATH.join(features.cwd, './src/plugins/yoco/content/index.html')).toString();
                        let variablesToClient = {
                            url: features.getPluginConfig().myHost + '/Yoco/' + req.params.token,
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
                        features.log.error(xcc);
                        res.status(400).send('An unknown error occurred');
                    }
                }
            });
            features.log.debug(`loaded`);
            features.initForPlugins('plugin-express', 'post', {
                arg1: '/Yoco/:token',
                arg2: (req: ERequest, res: EResponse) => {
                    try {
                        /*const cipherText = Buffer.from(decodeURIComponent(req.params.token), "base64");
                        const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                            authTagLength: 16
                        });
                        let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
                        let decrypted = eAndD.decrypt(features, decodeURIComponent(req.params.token));
                        let data = JSON.parse(decrypted);
                        let reqData = req.body;
                        console.log(reqData);
                        let now = new Date().getTime();
                        if (now >= data.timeExpiry)
                            throw 'Time expired!';
                        features.log.debug(data);
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
                                features.emitEvent(data.notifyService, YocoSourcePluginEvents.paymentComplete, {
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
                            features.log.error(x.data);
                            res.status(500).send({ status: false, message: x.data.displayMessage });
                        }).catch(x => {
                            features.log.error(x.response.data);
                            res.status(500).send({ status: false, message: x.response.data.displayMessage });
                        });
                    }
                    catch (xcc) {
                        features.log.error(xcc);
                        res.status(400).send({ status: false, message: 'An unknown error occurred' });
                    }
                }
            });
            features.log.debug('YOCO READY');
            resolve();
        });
    };
}
