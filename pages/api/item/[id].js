import { ethers } from 'ethers'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
const RPC_URL = 'https://mainnet.base.org'

const CONTRACT_ABI = [
  "function items(uint256) external view returns (uint256,address,string,string,string,uint256,address,bool,bool,uint256,string,string)",
  "function getClaimants(uint256) external view returns (address[])",
  "function getClaimMessage(uint256,address) external view returns (string)"
]

export default async function handler(req, res) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Item ID required' })
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    const itemData = await contract.items(id)
    const claimants = await contract.getClaimants(id)

    const claimMessages = {}
    for (const claimer of claimants) {
      const message = await contract.getClaimMessage(id, claimer)
      claimMessages[claimer] = message
    }

    const item = {
      id: Number(itemData[0]),
      owner: itemData[1],
      title: itemData[2],
      description: itemData[3],
      imageUrl: itemData[4],
      bountyAmount: itemData[5].toString(),
      finder: itemData[6],
      isClaimed: itemData[7],
      isResolved: itemData[8],
      createdAt: Number(itemData[9]),
      location: itemData[10],
      category: itemData[11],
      claimants: claimants,
      claimMessages: claimMessages
    }

    res.status(200).json(item)
  } catch (error) {
    console.error('Error fetching item:', error)
    res.status(500).json({ error: 'Failed to fetch item data' })
  }
}
