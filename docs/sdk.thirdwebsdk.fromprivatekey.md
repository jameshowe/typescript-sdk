<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [ThirdwebSDK](./sdk.thirdwebsdk.md) &gt; [fromPrivateKey](./sdk.thirdwebsdk.fromprivatekey.md)

## ThirdwebSDK.fromPrivateKey() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Get an instance of the thirdweb SDK based on a private key.

<b>Signature:</b>

```typescript
static fromPrivateKey(privateKey: string, network: ChainOrRpc, options?: SDKOptions): ThirdwebSDK;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  privateKey | string | the private key - \*\*DO NOT EXPOSE THIS TO THE PUBLIC\*\* |
|  network | ChainOrRpc | the network (chain) to connect to (e.g. "mainnet", "rinkeby", "polygon", "mumbai"...) or a fully formed RPC url |
|  options | [SDKOptions](./sdk.sdkoptions.md) | <i>(Optional)</i> the SDK options to use |

<b>Returns:</b>

[ThirdwebSDK](./sdk.thirdwebsdk.md)

an instance of the SDK

## Remarks

This should only be used for backend services or scripts, with the private key stored in a secure way. \*\*NEVER\*\* expose your private key to the public in any way.

## Example


```javascript
const sdk = ThirdwebSDK.fromPrivateKey("SecretPrivateKey", "mainnet");
```

