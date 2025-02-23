<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [ThirdwebSDK](./sdk.thirdwebsdk.md) &gt; [fromSigner](./sdk.thirdwebsdk.fromsigner.md)

## ThirdwebSDK.fromSigner() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Get an instance of the thirdweb SDK based on an existing ethers signer

<b>Signature:</b>

```typescript
static fromSigner(signer: Signer, network?: ChainOrRpc, options?: SDKOptions): ThirdwebSDK;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  signer | Signer | a ethers Signer to be used for transactions |
|  network | ChainOrRpc | <i>(Optional)</i> the network (chain) to connect to (e.g. "mainnet", "rinkeby", "polygon", "mumbai"...) or a fully formed RPC url |
|  options | [SDKOptions](./sdk.sdkoptions.md) | <i>(Optional)</i> the SDK options to use |

<b>Returns:</b>

[ThirdwebSDK](./sdk.thirdwebsdk.md)

an instance of the SDK

## Example


```javascript
// get a signer from somewhere (createRandom is being used purely for example purposes)
const signer = ethers.Wallet.createRandom();

// get an instance of the SDK with the signer already setup
const sdk = ThirdwebSDK.fromSigner(signer, "mainnet");
```

