import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="nav-link">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button className="btn btn-outline" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  const handleConnect = () => {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
  }

  return (
    <button
      className="btn btn-primary"
      onClick={handleConnect}
      disabled={connectors.length === 0}
    >
      Connect Wallet
    </button>
  )
}
