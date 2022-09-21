import { ServiceCallable, ServicesClient } from "@bettercorp/service-base";
import { IDictionary } from "@bettercorp/tools/lib/Interfaces";
import {
  IClientConfig,
  YocoPaymentRequestData,
  YocoPaymentRequestResponse,
  YocoPaymentResult,
} from "../../lib";
import { YocoEmitReturnableEvents } from "../../plugins/service-yoco/plugin";
import { YocoEmitEvents } from "../../plugins/service-yoco/plugin";
import { YocoReturnableEvents } from "../../plugins/service-yoco/plugin";
import { YocoPluginConfig } from "../../plugins/service-yoco/sec.config";

export class yoco
  extends ServicesClient<
    ServiceCallable,
    YocoEmitEvents,
    YocoReturnableEvents,
    YocoEmitReturnableEvents,
    ServiceCallable,
    YocoPluginConfig
  >
  implements YocoReturnableEvents
{
  public override readonly _pluginName = "service-yoco";

  public async ping(): Promise<boolean> {
    return await this._plugin.emitEventAndReturn("ping");
  }
  public async makePaymentRequest(
    client: IClientConfig,
    data: YocoPaymentRequestData
  ): Promise<YocoPaymentRequestResponse> {
    return await this._plugin.emitEventAndReturn(
      "makePaymentRequest",
      client,
      data
    );
  }

  async onGetSecret(listener: {
    (
      notifyService: string,
      publicKey: string,
      paymentReference: string,
      paymentInternalReference: string
    ): Promise<string>;
  }) {
    this._plugin.onReturnableEvent(
      "onGetSecret",
      async (
        notifyService: string,
        publicKey: string,
        paymentReference: string,
        paymentInternalReference: string
      ): Promise<string> =>
        await listener(
          notifyService,
          publicKey,
          paymentReference,
          paymentInternalReference
        )
    );
  }

  async onPaymentComplete(listener: {
    (
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
  }) {
    this._plugin.onEvent(
      "onPaymentComplete",
      async (
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
      ): Promise<void> =>
        await listener(
          notifyService,
          publicKey,
          live,
          amount,
          paymentReference,
          paymentInternalReference,
          additionalData,
          currency,
          firstName,
          lastName,
          email,
          cell,
          payment
        )
    );
  }
}
