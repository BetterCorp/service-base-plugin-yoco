import { Tools } from "@bettercorp/tools/lib/Tools";
import {
  IClientConfig,
  YocoDefaults,
  YocoPaymentFailedData,
  YocoPaymentRequestData,
  YocoPaymentRequestResponse,
  YocoPaymentResult,
} from "../../lib";
import AXIOS from "axios";
import { AxiosResponse as AResponse } from "axios";
import * as crypto from "crypto";
import * as FS from "fs";
import * as PATH from "path";
import { eAndD } from "./eAndD";
import { fastify } from "@bettercorp/service-base-plugin-web-server";
import {
  IPluginLogger,
  ServiceCallable,
  ServicesBase,
} from "@bettercorp/service-base";
import { YocoPluginConfig } from "./sec.config";
import { IDictionary } from "@bettercorp/tools/lib/Interfaces";

export interface YocoReturnableEvents extends ServiceCallable {
  ping(): Promise<boolean>;
  makePaymentRequest(
    client: IClientConfig,
    data: YocoPaymentRequestData
  ): Promise<YocoPaymentRequestResponse>;
}

export interface YocoEmitEvents extends ServiceCallable {
  onPaymentComplete(
    notifyService: string,
    publicKey: string,
    live: Boolean,
    amount: number,
    paymentReference: string,
    paymentInternalReference: string,
    additionalData: IDictionary<string>,
    currency: string,
    firstName: string,
    lastName: string,
    email: string,
    cell: string,
    payment: {
      req: any;
      res: YocoPaymentResult;
    }
  ): Promise<void>;
}
export interface YocoEmitReturnableEvents extends ServiceCallable {
  onGetSecret(
    notifyService: string,
    publicKey: string,
    paymentReference: string,
    paymentInternalReference: string
  ): Promise<string>;
}

export class Service extends ServicesBase<
  ServiceCallable,
  YocoEmitEvents,
  YocoReturnableEvents,
  YocoEmitReturnableEvents,
  ServiceCallable,
  YocoPluginConfig
> {
  private fastify: fastify;
  constructor(pluginName: string, cwd: string, log: IPluginLogger) {
    super(pluginName, cwd, log);
    this.fastify = new fastify(this);
  }
  private getYocoUrl(action: string): string {
    return `${YocoDefaults.url}${YocoDefaults.version}/${action}/`;
  }
  public override async init(): Promise<void> {
    const self = this;
    self.onReturnableEvent(
      "ping",
      (): Promise<boolean> =>
        new Promise(async (resolve, reject) => {
          AXIOS.post<any>(
            self.getYocoUrl("charges"),
            {},
            {
              headers: {
                "X-Auth-Secret-Key": (await self.getPluginConfig())
                  .sandboxConfig.secretKey,
              },
            }
          )
            .then((x) => {
              resolve(
                x.status === 400 && x.data.errorType === "invalid_request_error"
              );
            })
            .catch((x) => {
              self.log.error(x);
              resolve(false);
            });
        })
    );
    self.onReturnableEvent(
      "makePaymentRequest",
      (
        client: IClientConfig,
        data: YocoPaymentRequestData
      ): Promise<YocoPaymentRequestResponse> =>
        new Promise(async (resolve, reject) => {
          let merchantConfig = (await self.getPluginConfig()).sandboxConfig;
          if (client.live === true) {
            merchantConfig.publicKey = client.publicKey;
            merchantConfig.secretKey = client.secretKey;
          }
          try {
            let amountInCents = Number.parseInt((data.amount * 100).toFixed(0));
            let workingObj = {
              live: client.live,
              time: new Date().getTime(),
              timeExpiry: new Date().getTime() + 1000 * 60 * 60,
              publicKey: merchantConfig.publicKey,
              returnUrl: data.returnUrl,
              cancelUrl: data.cancelUrl,
              paymentReference: data.paymentReference,
              paymentInternalReference: data.paymentInternalReference,
              additionalData: data.additionalData,
              currency: data.currency,
              symbol: data.symbol,
              amount: data.amount,
              amountFormatted: Tools.formatCurrency(
                data.amount,
                2,
                ".",
                " ",
                data.symbol
              ),
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              cell: data.cell,
              amountInCents: amountInCents,
              random: crypto
                .randomBytes(Math.floor(Math.random() * 100 + 1))
                .toString("hex"),
              notifyService: data.sourcePluginName,
            };
            /*let requestCipher = crypto.createCipheriv('aes-256-ccm', Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let requestKey = Buffer.concat([requestCipher.update(JSON.stringify(workingObj)), requestCipher.final()]).toString('base64');*/
            let requestKey = await eAndD.encrypt(
              (
                await self.getPluginConfig()
              ).commsToken,
              (
                await self.getPluginConfig()
              ).commsTokenIV,
              JSON.stringify(workingObj)
            );
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
              url: `${
                (await self.getPluginConfig()).myHost
              }/Yoco/Start?ref=${encodeURIComponent(requestKey)}`,
              request: {
                //live: client.live,
                time: new Date().getTime(),
                timeExpiry: 0,
                publicKey: merchantConfig.publicKey,
                returnUrl: data.returnUrl,
                cancelUrl: data.cancelUrl,
                paymentReference: data.paymentReference,
                paymentInternalReference: data.paymentInternalReference,
                additionalData: data.additionalData,
                currency: data.currency,
                symbol: data.symbol,
                amount: data.amount,
                amountFormatted: Tools.formatCurrency(
                  data.amount,
                  2,
                  ".",
                  " ",
                  data.symbol
                ),
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                cell: data.cell,
                amountInCents: amountInCents,
                random: "",
                notifyService: data.sourcePluginName,
              },
            });
          } catch (erc) {
            self.log.error(erc as Error);
            return reject(erc);
          }
        })
    );

    self.fastify.get<
      any,
      any,
      {
        ref: string;
      },
      any
    >("/Yoco/Start", async (req, res) => {
      try {
        if (req.query === undefined || req.query == null)
          throw "undefined query";
        /*const cipherText = Buffer.from(decodeURIComponent(req.query.ref), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
        let decrypted = await eAndD.decrypt(
          (
            await self.getPluginConfig()
          ).commsToken,
          (
            await self.getPluginConfig()
          ).commsTokenIV,
          decodeURIComponent(req.query.ref)
        );
        let data = JSON.parse(decrypted);
        let now = new Date().getTime();
        if (now >= data.timeExpiry) throw "Time expired!";
        let content = FS.readFileSync(
          PATH.join(
            self.cwd,
            "./node_modules/@bettercorp/service-base-plugin-yoco/content/yoco/index.html"
          )
        ).toString();
        let variablesToClient = {
          url: (await self.getPluginConfig()).myHost + "/Yoco/Start",
          ref: req.query.ref,
          amountFormatted: data.amountFormatted,
          amountCents: data.amountInCents,
          currency: data.currency,
          publicKey: data.publicKey,
          description: data.paymentReference,
          metadata: {
            internalReference: data.paymentInternalReference,
            additionalData: data.additionalData,
          },
          customer: {
            email: data.email,
            phone: data.cell,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        };
        content = content.replace(
          "{{VARIABLES}}",
          JSON.stringify(variablesToClient)
        );
        res.header("content-type", "text/html");
        res.send(content);
      } catch (xcc) {
        self.log.error(xcc as Error);
        res.status(400).send("An unknown error occurred");
      }
    });

    self.fastify.post<any, any, any, any>(
      "/Yoco/Start",
      async (req, res): Promise<any> => {
        try {
          if (req.query === undefined || req.query == null)
            throw "undefined query";
          /*const cipherText = Buffer.from(decodeURIComponent(req.query.ref), "base64");
                    const cipher = crypto.createDecipheriv("aes-256-ccm", Buffer.from(features.getPluginConfig().commsToken, 'hex'), crypto.pseudoRandomBytes(6).toString('hex'), {
                        authTagLength: 16
                    });
                    let decrypted = Buffer.concat([cipher.update(cipherText), cipher.final()]).toString('utf8');*/
          let reqData = req.body as any;
          let decrypted = await eAndD.decrypt(
            (
              await self.getPluginConfig()
            ).commsToken,
            (
              await self.getPluginConfig()
            ).commsTokenIV,
            decodeURIComponent(reqData.ref)
          );
          let data = JSON.parse(decrypted);

          let now = new Date().getTime();
          if (now >= data.timeExpiry) throw "Time expired!";

          let secretKey = await this.emitEventAndReturn(
            "onGetSecret",
            data.notifyService,
            data.publicKey,
            data.paymentReference,
            data.paymentInternalReference
          );

          if (Tools.isNullOrUndefined(secretKey)) {
            self.log.error("UNABLE TO GET SECRET FROM SRC");
            return res.status(500).send({
              status: false,
              message: "Unable to verify payment request",
            });
          }

          AXIOS.post<any>(
            self.getYocoUrl("charges"),
            {
              token: reqData.id,
              amountInCents: data.amountInCents,
              currency: data.currency,
            },
            {
              headers: {
                "X-Auth-Secret-Key": secretKey!,
              },
            }
          )
            .then(
              (
                x: AResponse<YocoPaymentResult | YocoPaymentFailedData, any>
              ): any | void => {
                if (x.status === 201) {
                  self.emitEvent(
                    "onPaymentComplete",
                    data.notifyService,
                    data.live,
                    data.publicKey,
                    data.amountInCents,
                    data.paymentReference,
                    data.paymentInternalReference,
                    data.additionalData,
                    data.currency,
                    data.firstName,
                    data.lastName,
                    data.email,
                    data.cell,
                    {
                      req: reqData,
                      res: x.data as YocoPaymentResult,
                    }
                  );
                  return res.status(201).send({
                    status:
                      (x.data as YocoPaymentResult).status === "successful",
                    reference: data.paymentReference,
                    internalReference: data.paymentInternalReference,
                  });
                }
                self.log.error(x.data.toString());
                res.status(500).send({
                  status: false,
                  message: (x.data as YocoPaymentFailedData).displayMessage,
                });
              }
            )
            .catch((x) => {
              self.log.error(x.response.data);
              res.status(500).send({
                status: false,
                message: x.response.data.displayMessage,
              });
            });
        } catch (xcc) {
          self.log.error(xcc as Error);
          res
            .status(400)
            .send({ status: false, message: "An unknown error occurred" });
        }
      }
    );
  }
}
