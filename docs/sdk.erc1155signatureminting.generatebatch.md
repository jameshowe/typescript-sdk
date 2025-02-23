<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [Erc1155SignatureMinting](./sdk.erc1155signatureminting.md) &gt; [generateBatch](./sdk.erc1155signatureminting.generatebatch.md)

## Erc1155SignatureMinting.generateBatch() method

Genrate a batch of signatures that can be used to mint many dynamic NFTs.

<b>Signature:</b>

```typescript
generateBatch(payloadsToSign: PayloadToSign1155[]): Promise<SignedPayload1155[]>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  payloadsToSign | [PayloadToSign1155](./sdk.payloadtosign1155.md)<!-- -->\[\] | the payloads to sign |

<b>Returns:</b>

Promise&lt;[SignedPayload1155](./sdk.signedpayload1155.md)<!-- -->\[\]&gt;

an array of payloads and signatures

## Remarks

See [Erc721SignatureMinting.generate()](./sdk.erc721signatureminting.generate.md)

