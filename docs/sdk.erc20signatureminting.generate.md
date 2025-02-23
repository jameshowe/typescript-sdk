<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [Erc20SignatureMinting](./sdk.erc20signatureminting.md) &gt; [generate](./sdk.erc20signatureminting.generate.md)

## Erc20SignatureMinting.generate() method

Generate a signature that can be used to mint a certain amount of tokens

<b>Signature:</b>

```typescript
generate(mintRequest: PayloadToSign20): Promise<SignedPayload20>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  mintRequest | [PayloadToSign20](./sdk.payloadtosign20.md) | the payload to sign |

<b>Returns:</b>

Promise&lt;[SignedPayload20](./sdk.signedpayload20.md)<!-- -->&gt;

the signed payload and the corresponding signature

## Remarks

Takes in a quantity of tokens, some conditions for how it can be minted and signs it with your private key. The generated signature can then be used to mint those tokens using the exact payload and signature generated.

## Example


```javascript
const startTime = new Date();
const endTime = new Date(Date.now() + 60 * 60 * 24 * 1000);
const payload = {
  quantity: 4.2, // The quantity of tokens to be minted
  to: {{wallet_address}}, // Who will receive the tokens (or AddressZero for anyone)
  price: 0.5, // the price to pay for minting those tokens
  currencyAddress: NATIVE_TOKEN_ADDRESS, // the currency to pay with
  mintStartTime: startTime, // can mint anytime from now
  mintEndTime: endTime, // to 24h from now,
  primarySaleRecipient: "0x...", // custom sale recipient for this token mint
};

const signedPayload = contract.signature.generate(payload);
// now anyone can use these to mint the NFT using `contract.signature.mint(signedPayload)`
```

