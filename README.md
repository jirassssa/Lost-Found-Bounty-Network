# Lost & Found Bounty Network

A decentralized platform for reporting and claiming lost items with bounty rewards on Base blockchain.

## Features

- **Report Lost Items**: Post lost item reports with ETH bounty rewards
- **Claim Found Items**: Submit claims for items you've found with proof
- **Reputation System**: Build trust through successful recoveries
- **Transparent Bounties**: All rewards are secured in smart contracts
- **Item Categories**: Electronics, Jewelry, Documents, Keys, Bags, Pets, and more

## Smart Contract

- **Network**: Base Mainnet
- **Contract Address**: `0x32aeBD9f29C6Fc81D1E5CA1ba80E4CA34ee20FCB`
- **Block Explorer**: [View on BaseScan](https://basescan.org/address/0x32aeBD9f29C6Fc81D1E5CA1ba80E4CA34ee20FCB)

## Technology Stack

- **Blockchain**: Base (Ethereum L2)
- **Smart Contract**: Solidity 0.8.20
- **Frontend**: Next.js 15, React 19
- **Web3 Integration**: Wagmi, Viem, Ethers.js
- **Development**: Hardhat

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- ETH on Base network for gas fees

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd basebatch
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x32aeBD9f29C6Fc81D1E5CA1ba80E4CA34ee20FCB
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Smart Contract Development

Compile contracts:
```bash
npm run compile
```

Deploy to Base Mainnet:
```bash
npm run deploy
```

## How It Works

### For Item Owners (Lost Something)

1. **Connect Wallet**: Connect your Web3 wallet to the platform
2. **Report Item**: Fill in item details (title, description, location, category)
3. **Set Bounty**: Attach ETH as reward for the finder
4. **Review Claims**: Wait for people to claim they found your item
5. **Confirm Finder**: Review claims and confirm the legitimate finder
6. **Automatic Payout**: Smart contract automatically sends bounty to finder

### For Finders (Found Something)

1. **Browse Items**: View all reported lost items
2. **Submit Claim**: Provide details proving you found the item
3. **Wait for Confirmation**: Item owner reviews your claim
4. **Receive Bounty**: Get ETH reward automatically upon confirmation
5. **Build Reputation**: Earn reputation points for successful returns

### Reputation System

- **+10 points**: Successfully return an item
- **+5 points**: Item recovered (for reporters)
- **-1 point**: Cancel a report

## Smart Contract Features

- Secure escrow for bounty funds
- Platform fee: 2% of bounty amount
- Increase bounty after posting
- Cancel reports and get refund
- Multiple claims per item
- Transparent claim history
- User reputation tracking

## Project Structure

```
basebatch/
├── contracts/          # Solidity smart contracts
├── scripts/           # Deployment scripts
├── pages/             # Next.js pages
├── src/
│   ├── components/    # React components
│   ├── config/        # Configuration files
│   └── styles/        # CSS styles
├── hardhat.config.js  # Hardhat configuration
└── next.config.js     # Next.js configuration
```

## Security

- All funds secured in audited smart contract
- No private keys stored on frontend
- Wallet signature required for all transactions
- Platform fee capped at 10% maximum
- Cannot transfer funds without owner confirmation

## Support

For issues or questions:
- Create an issue in the repository
- Check existing documentation
- Review smart contract on BaseScan

## License

ISC

---

Built for Base Batches Startup Track
