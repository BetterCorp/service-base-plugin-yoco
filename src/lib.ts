import { IDictionary } from "@bettercorp/tools/lib/Interfaces";

export enum YocoDefaults {
  url = "https://online.yoco.com/",
  version = "v1",
}
export interface IClientConfig {
  live: Boolean;
  publicKey: string;
  secretKey: string;
}
export interface YocoPaymentRequest {
  data: YocoPaymentRequestData;
  client: IClientConfig;
}
export interface YocoPaymentRequestResponse {
  url: string;
  request: YocoPaymentTokenData;
}
export interface YocoPaymentRequestData {
  cancelUrl: string;
  returnUrl: string;
  amount: number;
  paymentReference: string;
  paymentInternalReference: string;
  additionalData: IDictionary<string>;
  currency: string;
  symbol: string;
  sourcePluginName: string;
  firstName: string;
  lastName: string;
  email: string;
  cell: string;
}
export interface YocoPaymentTokenData {
  time: number;
  timeExpiry: number;
  publicKey: string;
  //secretKey: string;
  returnUrl: string;
  cancelUrl: string;
  paymentReference: string;
  paymentInternalReference: string;
  additionalData: IDictionary<string>;
  currency: string;
  symbol: string;
  amount: number;
  amountFormatted: string;
  firstName: string;
  lastName: string;
  email: string;
  cell: string;
  amountInCents: number;
  random: string;
  notifyService: string;
}
export interface YocoPaymentClientData {
  url: string;
  amountFormatted: string;
  amountCents: number;
  currency: string;
  publicKey: string;
  description: string;
  metadata: YocoPaymentClientMetaData;
  customer: YocoPaymentClientCustomerData;
}
export interface YocoPaymentClientMetaData {
  internalReference: string;
  additionalData: IDictionary<string>;
}
export interface YocoGetSecret {
  publicKey: string;
  paymentReference: string;
  paymentInternalReference: string;
}
export interface YocoPaymentClientCustomerData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}
export interface YocoPaymentCompleteData {
  publicKey: string;
  live: Boolean;
  amount: number;
  paymentReference: string;
  paymentInternalReference: string;
  additionalData: IDictionary<string>;
  currency: string;
  firstName: string;
  lastName: string;
  email: string;
  cell: string;
  payment: {
    req: any;
    res: YocoPaymentResult;
  };
}
export interface YocoPaymentFailedData {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage: string;
}
export interface YocoPaymentResult {
  source: YocoPaymentResultSource;
  object: string;
  id: string;
  status: string;
  currency: string;
  amountInCents: number;
  liveMode: boolean;
  metadata: any;
}
export interface YocoPaymentResultSource {
  id: string;
  brand: string;
  maskedCard: string;
  expiryMonth: number;
  expiryYear: number;
  fingerprint: string;
  object: string;
  country: string;
}
