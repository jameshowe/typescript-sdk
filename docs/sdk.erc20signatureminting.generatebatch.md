<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [Erc20SignatureMinting](./sdk.erc20signatureminting.md) &gt; [generateBatch](./sdk.erc20signatureminting.generatebatch.md)

## Erc20SignatureMinting.generateBatch() method

Generate a batch of signatures that can be used to mint many token signatures.

<b>Signature:</b>

```typescript
generateBatch(payloadsToSign: PayloadToSign20[]): Promise<SignedPayload20[]>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  payloadsToSign | [PayloadToSign20](./sdk.payloadtosign20.md)<!-- -->\[\] | the payloads to sign |

<b>Returns:</b>

Promise&lt;[SignedPayload20](./sdk.signedpayload20.md)<!-- -->\[\]&gt;

an array of payloads and signatures

## Remarks

See [Erc20SignatureMinting.generate()](./sdk.erc20signatureminting.generate.md)

