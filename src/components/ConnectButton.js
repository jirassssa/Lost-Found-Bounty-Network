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

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          className="btn btn-primary"
          onClick={() => connect({ connector })}
        >
          Connect Wallet
        </button>
      ))}
    </div>
  )
}
