import { ethers } from 'ethers'
import CONTRACT_ABI from '../../../src/config/abi.json'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
const RPC_URL = 'https://mainnet.base.org'

export default async function handler(req, res) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    const itemCount = await contract.itemCounter()
    const items = []

    // Load all items sequentially (more stable)
    for (let i = 1; i <= Number(itemCount); i++) {
      try {
        const itemData = await contract.items(i)
        const claimants = await contract.getClaimants(i)

        const claimMessages = {}
        for (const claimer of claimants) {
          try {
            const message = await contract.getClaimMessage(i, claimer)
            claimMessages[claimer] = message
          } catch (err) {
            console.error(`Error getting claim message for ${claimer}:`, err)
          }
        }

        items.push({
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
        })
      } catch (error) {
        console.error(`Error loading item ${i}:`, error.message)
        // Continue with next item
      }
    }

    res.status(200).json({
      items: items,
      itemCount: Number(itemCount)
    })
  } catch (error) {
    console.error('Error fetching all items:', error)
    res.status(500).json({ error: 'Failed to fetch items', message: error.message })
  }
}
