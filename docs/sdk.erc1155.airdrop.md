<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@thirdweb-dev/sdk](./sdk.md) &gt; [Erc1155](./sdk.erc1155.md) &gt; [airdrop](./sdk.erc1155.airdrop.md)

## Erc1155.airdrop() method

Airdrop multiple NFTs

<b>Signature:</b>

```typescript
airdrop(tokenId: BigNumberish, addresses: AirdropInput, data?: BytesLike): Promise<TransactionResult>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  tokenId | BigNumberish |  |
|  addresses | [AirdropInput](./sdk.airdropinput.md) |  |
|  data | BytesLike | <i>(Optional)</i> |

<b>Returns:</b>

Promise&lt;[TransactionResult](./sdk.transactionresult.md)<!-- -->&gt;

## Remarks

Airdrop one or multiple NFTs to the provided wallet addresses.

## Example


```javascript
// Array of objects of addresses and quantities to airdrop NFTs to
const addresses = [
 {
   address: "0x...",
   quantity: 2,
 },
 {
  address: "0x...",
   quantity: 3,
 },
];
const tokenId = "0";
await contract.airdrop(addresses, tokenId);

// You can also pass an array of addresses, it will airdrop 1 NFT per address
const addresses = [
 "0x...", "0x...", "0x...",
]
const tokenId = "0";
await contract.airdrop(addresses, tokenId);
```

