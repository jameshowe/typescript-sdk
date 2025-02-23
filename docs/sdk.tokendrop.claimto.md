<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [TokenDrop](./sdk.tokendrop.md) &gt; [claimTo](./sdk.tokendrop.claimto.md)

## TokenDrop.claimTo() method

Claim a certain amount of tokens to a specific Wallet

<b>Signature:</b>

```typescript
claimTo(destinationAddress: string, amount: Amount, proofs?: BytesLike[]): Promise<TransactionResult>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  destinationAddress | string | Address you want to send the token to |
|  amount | [Amount](./sdk.amount.md) | Quantity of the tokens you want to claim |
|  proofs | BytesLike\[\] | <i>(Optional)</i> Optional Array of proofs |

<b>Returns:</b>

Promise&lt;[TransactionResult](./sdk.transactionresult.md)<!-- -->&gt;

- The transaction receipt

## Remarks

Let the specified wallet claim Tokens.

## Example


```javascript
const address = "{{wallet_address}}"; // address of the wallet you want to claim the NFTs
const quantity = 42.69; // how many tokens you want to claim

const tx = await contract.claimTo(address, quantity);
const receipt = tx.receipt; // the transaction receipt
```

