// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LostAndFound
 * @dev Lost & Found Bounty Network - Decentralized system for reporting and claiming lost items
 */
contract LostAndFound {

    struct Item {
        uint256 id;
        address owner;
        string title;
        string description;
        string imageUrl;
        uint256 bountyAmount;
        address finder;
        bool isClaimed;
        bool isResolved;
        uint256 createdAt;
        string location;
        string category;
    }

    struct User {
        uint256 itemsReported;
        uint256 itemsFound;
        uint256 totalBountyEarned;
        int256 reputationScore;
        bool isRegistered;
    }

    mapping(uint256 => Item) public items;
    mapping(address => User) public users;
    mapping(uint256 => mapping(address => string)) public claimMessages;
    mapping(uint256 => address[]) public claimants;

    uint256 public itemCounter;
    uint256 public platformFeePercent = 2; // 2% platform fee
    address public platformWallet;

    event ItemReported(
        uint256 indexed itemId,
        address indexed owner,
        string title,
        uint256 bountyAmount,
        uint256 timestamp
    );

    event ItemClaimed(
        uint256 indexed itemId,
        address indexed claimer,
        string message,
        uint256 timestamp
    );

    event ItemResolved(
        uint256 indexed itemId,
        address indexed finder,
        uint256 bountyAmount,
        uint256 timestamp
    );

    event BountyIncreased(
        uint256 indexed itemId,
        address indexed contributor,
        uint256 amount,
        uint256 newTotal
    );

    event ReputationUpdated(
        address indexed user,
        int256 newScore,
        string reason
    );

    modifier onlyItemOwner(uint256 _itemId) {
        require(items[_itemId].owner == msg.sender, "Not item owner");
        _;
    }

    modifier itemExists(uint256 _itemId) {
        require(_itemId > 0 && _itemId <= itemCounter, "Item does not exist");
        _;
    }

    modifier notResolved(uint256 _itemId) {
        require(!items[_itemId].isResolved, "Item already resolved");
        _;
    }

    constructor() {
        platformWallet = msg.sender;
    }

    /**
     * @dev Register a new user or update existing user info
     */
    function registerUser() public {
        if (!users[msg.sender].isRegistered) {
            users[msg.sender].isRegistered = true;
            users[msg.sender].reputationScore = 0;
        }
    }

    /**
     * @dev Report a lost item with bounty
     */
    function reportLostItem(
        string memory _title,
        string memory _description,
        string memory _imageUrl,
        string memory _location,
        string memory _category
    ) external payable returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(msg.value > 0, "Bounty amount must be greater than 0");

        if (!users[msg.sender].isRegistered) {
            registerUser();
        }

        itemCounter++;

        items[itemCounter] = Item({
            id: itemCounter,
            owner: msg.sender,
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            bountyAmount: msg.value,
            finder: address(0),
            isClaimed: false,
            isResolved: false,
            createdAt: block.timestamp,
            location: _location,
            category: _category
        });

        users[msg.sender].itemsReported++;

        emit ItemReported(
            itemCounter,
            msg.sender,
            _title,
            msg.value,
            block.timestamp
        );

        return itemCounter;
    }

    /**
     * @dev Claim to have found an item
     */
    function claimItem(
        uint256 _itemId,
        string memory _message
    ) external itemExists(_itemId) notResolved(_itemId) {
        require(msg.sender != items[_itemId].owner, "Owner cannot claim own item");
        require(bytes(_message).length > 0, "Claim message required");

        if (!users[msg.sender].isRegistered) {
            registerUser();
        }

        // Check if user already claimed this item
        bool alreadyClaimed = false;
        for (uint256 i = 0; i < claimants[_itemId].length; i++) {
            if (claimants[_itemId][i] == msg.sender) {
                alreadyClaimed = true;
                break;
            }
        }

        require(!alreadyClaimed, "Already claimed this item");

        claimMessages[_itemId][msg.sender] = _message;
        claimants[_itemId].push(msg.sender);

        emit ItemClaimed(_itemId, msg.sender, _message, block.timestamp);
    }

    /**
     * @dev Confirm a finder and release bounty
     */
    function confirmFinder(
        uint256 _itemId,
        address _finder
    ) external
        itemExists(_itemId)
        onlyItemOwner(_itemId)
        notResolved(_itemId)
    {
        require(_finder != address(0), "Invalid finder address");
        require(_finder != msg.sender, "Cannot confirm yourself");

        // Verify that the finder actually claimed the item
        bool isValidClaimer = false;
        for (uint256 i = 0; i < claimants[_itemId].length; i++) {
            if (claimants[_itemId][i] == _finder) {
                isValidClaimer = true;
                break;
            }
        }
        require(isValidClaimer, "Finder did not claim this item");

        Item storage item = items[_itemId];
        item.finder = _finder;
        item.isClaimed = true;
        item.isResolved = true;

        // Calculate platform fee and finder reward
        uint256 platformFee = (item.bountyAmount * platformFeePercent) / 100;
        uint256 finderReward = item.bountyAmount - platformFee;

        // Update user stats
        users[_finder].itemsFound++;
        users[_finder].totalBountyEarned += finderReward;

        // Update reputation
        users[_finder].reputationScore += 10;
        users[msg.sender].reputationScore += 5;

        // Transfer bounty
        (bool successFinder, ) = payable(_finder).call{value: finderReward}("");
        require(successFinder, "Finder transfer failed");

        (bool successPlatform, ) = payable(platformWallet).call{value: platformFee}("");
        require(successPlatform, "Platform fee transfer failed");

        emit ItemResolved(_itemId, _finder, finderReward, block.timestamp);
        emit ReputationUpdated(_finder, users[_finder].reputationScore, "Item found");
        emit ReputationUpdated(msg.sender, users[msg.sender].reputationScore, "Item recovered");
    }

    /**
     * @dev Cancel item report and refund bounty
     */
    function cancelItemReport(uint256 _itemId)
        external
        itemExists(_itemId)
        onlyItemOwner(_itemId)
        notResolved(_itemId)
    {
        Item storage item = items[_itemId];
        uint256 refundAmount = item.bountyAmount;

        item.isResolved = true;
        item.bountyAmount = 0;

        // Slight reputation penalty for canceling
        users[msg.sender].reputationScore -= 1;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");

        emit ReputationUpdated(msg.sender, users[msg.sender].reputationScore, "Report cancelled");
    }

    /**
     * @dev Increase bounty for an item
     */
    function increaseBounty(uint256 _itemId)
        external
        payable
        itemExists(_itemId)
        notResolved(_itemId)
    {
        require(msg.value > 0, "Must send ETH to increase bounty");

        items[_itemId].bountyAmount += msg.value;

        emit BountyIncreased(
            _itemId,
            msg.sender,
            msg.value,
            items[_itemId].bountyAmount
        );
    }

    /**
     * @dev Get all claimants for an item
     */
    function getClaimants(uint256 _itemId)
        external
        view
        itemExists(_itemId)
        returns (address[] memory)
    {
        return claimants[_itemId];
    }

    /**
     * @dev Get claim message from a specific claimer
     */
    function getClaimMessage(uint256 _itemId, address _claimer)
        external
        view
        itemExists(_itemId)
        returns (string memory)
    {
        return claimMessages[_itemId][_claimer];
    }

    /**
     * @dev Get user profile
     */
    function getUserProfile(address _user)
        external
        view
        returns (
            uint256 itemsReported,
            uint256 itemsFound,
            uint256 totalBountyEarned,
            int256 reputationScore,
            bool isRegistered
        )
    {
        User memory user = users[_user];
        return (
            user.itemsReported,
            user.itemsFound,
            user.totalBountyEarned,
            user.reputationScore,
            user.isRegistered
        );
    }

    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 _newFeePercent) external {
        require(msg.sender == platformWallet, "Only platform owner");
        require(_newFeePercent <= 10, "Fee cannot exceed 10%");
        platformFeePercent = _newFeePercent;
    }

    /**
     * @dev Update platform wallet (only owner)
     */
    function updatePlatformWallet(address _newWallet) external {
        require(msg.sender == platformWallet, "Only platform owner");
        require(_newWallet != address(0), "Invalid wallet address");
        platformWallet = _newWallet;
    }
}
