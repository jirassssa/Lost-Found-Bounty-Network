import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import ConnectButton from '../src/components/ConnectButton'

// Contract configuration - update after deployment
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'

const CONTRACT_ABI = [
  "function reportLostItem(string,string,string,string,string) external payable returns (uint256)",
  "function claimItem(uint256,string) external",
  "function confirmFinder(uint256,address) external",
  "function cancelItemReport(uint256) external",
  "function increaseBounty(uint256) external payable",
  "function items(uint256) external view returns (uint256,address,string,string,string,uint256,address,bool,bool,uint256,string,string)",
  "function itemCounter() external view returns (uint256)",
  "function getClaimants(uint256) external view returns (address[])",
  "function getClaimMessage(uint256,address) external view returns (string)",
  "function getUserProfile(address) external view returns (uint256,uint256,uint256,int256,bool)",
  "event ItemReported(uint256 indexed,address indexed,string,uint256,uint256)",
  "event ItemClaimed(uint256 indexed,address indexed,string,uint256)",
  "event ItemResolved(uint256 indexed,address indexed,uint256,uint256)"
]

export default function Home() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState('browse')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [userProfile, setUserProfile] = useState(null)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    location: '',
    category: '',
    bountyAmount: ''
  })

  const [claimMessage, setClaimMessage] = useState('')

  const { writeContract } = useWriteContract()

  const { data: itemCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'itemCounter',
  })

  const { data: profileData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getUserProfile',
    args: address ? [address] : undefined,
  })

  useEffect(() => {
    if (profileData) {
      setUserProfile({
        itemsReported: Number(profileData[0]),
        itemsFound: Number(profileData[1]),
        totalBountyEarned: formatEther(profileData[2]),
        reputationScore: Number(profileData[3]),
        isRegistered: profileData[4]
      })
    }
  }, [profileData])

  useEffect(() => {
    loadItems()
  }, [itemCount])

  const loadItems = async () => {
    if (!itemCount) return

    setLoading(true)
    const loadedItems = []

    try {
      for (let i = 1; i <= Number(itemCount); i++) {
        try {
          const response = await fetch(`/api/item/${i}`)
          if (response.ok) {
            const item = await response.json()
            loadedItems.push(item)
          }
        } catch (err) {
          console.error(`Error loading item ${i}:`, err)
        }
      }

      setItems(loadedItems.reverse())
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReportItem = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      setLoading(true)
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'reportLostItem',
        args: [
          formData.title,
          formData.description,
          formData.imageUrl,
          formData.location,
          formData.category
        ],
        value: parseEther(formData.bountyAmount)
      })

      alert('Item reported successfully!')
      setShowReportModal(false)
      setFormData({
        title: '',
        description: '',
        imageUrl: '',
        location: '',
        category: '',
        bountyAmount: ''
      })
      setTimeout(() => loadItems(), 2000)
    } catch (error) {
      console.error('Error reporting item:', error)
      alert('Failed to report item: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleClaimItem = async (itemId) => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    if (!claimMessage.trim()) {
      alert('Please provide details about the item')
      return
    }

    try {
      setLoading(true)
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'claimItem',
        args: [itemId, claimMessage]
      })

      alert('Claim submitted successfully!')
      setClaimMessage('')
      setShowDetailModal(false)
      setTimeout(() => loadItems(), 2000)
    } catch (error) {
      console.error('Error claiming item:', error)
      alert('Failed to submit claim: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const filterItems = () => {
    switch (activeTab) {
      case 'my-reports':
        return items.filter(item => item.owner?.toLowerCase() === address?.toLowerCase())
      case 'my-claims':
        return items.filter(item =>
          item.claimants?.some(c => c.toLowerCase() === address?.toLowerCase())
        )
      case 'resolved':
        return items.filter(item => item.isResolved)
      default:
        return items.filter(item => !item.isResolved)
    }
  }

  const openItemDetail = async (item) => {
    try {
      const response = await fetch(`/api/item/${item.id}`)
      if (response.ok) {
        const fullItem = await response.json()
        setSelectedItem(fullItem)
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('Error loading item details:', error)
    }
  }

  return (
    <div>
      <header className="header">
        <nav className="nav container">
          <div className="logo">
            🔍 Lost & Found Network
          </div>
          <div className="nav-links">
            <ConnectButton />
          </div>
        </nav>
      </header>

      <main className="main-content container">
        {isConnected && userProfile && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{userProfile.itemsReported}</div>
              <div className="stat-label">Items Reported</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userProfile.itemsFound}</div>
              <div className="stat-label">Items Found</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number(userProfile.totalBountyEarned).toFixed(4)} ETH</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userProfile.reputationScore}</div>
              <div className="stat-label">Reputation</div>
            </div>
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Lost Items
          </button>
          <button
            className={`tab ${activeTab === 'my-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-reports')}
            disabled={!isConnected}
          >
            My Reports
          </button>
          <button
            className={`tab ${activeTab === 'my-claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-claims')}
            disabled={!isConnected}
          >
            My Claims
          </button>
          <button
            className={`tab ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved
          </button>
          {isConnected && (
            <button
              className="btn btn-primary"
              onClick={() => setShowReportModal(true)}
              style={{ marginLeft: 'auto' }}
            >
              + Report Lost Item
            </button>
          )}
        </div>

        {loading && <div className="loading">Loading...</div>}

        {!loading && (
          <div className="item-grid">
            {filterItems().length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-text">No items found</div>
              </div>
            ) : (
              filterItems().map(item => (
                <div
                  key={item.id}
                  className="item-card"
                  onClick={() => openItemDetail(item)}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="item-image" />
                  )}
                  <div className="item-content">
                    <div className="item-header">
                      <h3 className="item-title">{item.title}</h3>
                      <div className="bounty-badge">
                        {formatEther(item.bountyAmount)} ETH
                      </div>
                    </div>
                    <p className="item-description">{item.description}</p>
                    <div className="item-meta">
                      <span>📍 {item.location}</span>
                      <span>🏷️ {item.category}</span>
                      <span className={`status-badge ${
                        item.isResolved ? 'status-resolved' :
                        item.isClaimed ? 'status-claimed' : 'status-active'
                      }`}>
                        {item.isResolved ? 'Resolved' :
                         item.isClaimed ? 'Claimed' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Report Item Modal */}
        {showReportModal && (
          <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Report Lost Item</h2>
                <button className="modal-close" onClick={() => setShowReportModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleReportItem}>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL (optional)</label>
                    <input
                      type="url"
                      className="form-input"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      required
                    >
                      <option value="">Select category</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Jewelry">Jewelry</option>
                      <option value="Documents">Documents</option>
                      <option value="Keys">Keys</option>
                      <option value="Bags">Bags</option>
                      <option value="Pets">Pets</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bounty Amount (ETH)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      className="form-input"
                      value={formData.bountyAmount}
                      onChange={(e) => setFormData({...formData, bountyAmount: e.target.value})}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{width: '100%'}}>
                    {loading ? 'Submitting...' : 'Report Item'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Item Detail Modal */}
        {showDetailModal && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{selectedItem.title}</h2>
                <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                {selectedItem.imageUrl && (
                  <img src={selectedItem.imageUrl} alt={selectedItem.title} style={{width: '100%', borderRadius: '10px', marginBottom: '1rem'}} />
                )}
                <p><strong>Description:</strong> {selectedItem.description}</p>
                <p><strong>Location:</strong> {selectedItem.location}</p>
                <p><strong>Category:</strong> {selectedItem.category}</p>
                <p><strong>Bounty:</strong> {formatEther(selectedItem.bountyAmount)} ETH</p>
                <p><strong>Status:</strong> <span className={`status-badge ${
                  selectedItem.isResolved ? 'status-resolved' :
                  selectedItem.isClaimed ? 'status-claimed' : 'status-active'
                }`}>
                  {selectedItem.isResolved ? 'Resolved' :
                   selectedItem.isClaimed ? 'Claimed' : 'Active'}
                </span></p>

                {isConnected && !selectedItem.isResolved && selectedItem.owner?.toLowerCase() !== address?.toLowerCase() && (
                  <div style={{marginTop: '1.5rem'}}>
                    <label className="form-label">Claim this item</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Describe the item to prove you found it..."
                      value={claimMessage}
                      onChange={(e) => setClaimMessage(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleClaimItem(selectedItem.id)}
                      disabled={loading}
                      style={{width: '100%', marginTop: '1rem'}}
                    >
                      {loading ? 'Submitting...' : 'Submit Claim'}
                    </button>
                  </div>
                )}

                {selectedItem.claimants && selectedItem.claimants.length > 0 && (
                  <div style={{marginTop: '1.5rem'}}>
                    <h4>Claims ({selectedItem.claimants.length})</h4>
                    <ul className="claimant-list">
                      {selectedItem.claimants.map((claimer, idx) => (
                        <li key={idx} className="claimant-item">
                          <div className="claimant-info">
                            <div className="claimant-address">{claimer}</div>
                            <div className="claimant-message">
                              {selectedItem.claimMessages?.[claimer] || 'No message'}
                            </div>
                          </div>
                          {isConnected && selectedItem.owner?.toLowerCase() === address?.toLowerCase() && !selectedItem.isResolved && (
                            <button
                              className="btn btn-primary"
                              onClick={async () => {
                                try {
                                  await writeContract({
                                    address: CONTRACT_ADDRESS,
                                    abi: CONTRACT_ABI,
                                    functionName: 'confirmFinder',
                                    args: [selectedItem.id, claimer]
                                  })
                                  alert('Finder confirmed!')
                                  setShowDetailModal(false)
                                  setTimeout(() => loadItems(), 2000)
                                } catch (error) {
                                  alert('Failed to confirm finder')
                                }
                              }}
                            >
                              Confirm
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
