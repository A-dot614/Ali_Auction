import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { identityResolvers } from "./resolvers/identity.js";
import { sellerResolvers } from "./resolvers/seller.js";
import { catalogueResolvers } from "./resolvers/catalogue.js";
import { ordersResolvers } from "./resolvers/orders.js";
import { auctionResolvers } from "./resolvers/auction.js";

const HealthType = new GraphQLObjectType({
  name: "Health",
  fields: {
    status: { type: GraphQLString },
    service: { type: GraphQLString },
    databaseConfigured: { type: GraphQLBoolean },
    redisConfigured: { type: GraphQLBoolean },
  },
});

const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    emailVerified: { type: new GraphQLNonNull(GraphQLBoolean) },
    roles: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
  },
});

const ProfileType = new GraphQLObjectType({
  name: "Profile",
  fields: {
    userId: { type: new GraphQLNonNull(GraphQLID) },
    displayName: { type: GraphQLString },
    bio: { type: GraphQLString },
    provinceCode: { type: GraphQLString },
  },
});

const SessionType = new GraphQLObjectType({
  name: "Session",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    lastSeenAt: { type: new GraphQLNonNull(GraphQLString) },
    expiresAt: { type: new GraphQLNonNull(GraphQLString) },
    revokedAt: { type: GraphQLString },
    ipAddress: { type: GraphQLString },
    userAgent: { type: GraphQLString },
    isCurrent: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const SellerVerificationStatusEnum = new GraphQLEnumType({
  name: "SellerVerificationStatus",
  values: {
    not_submitted: { value: "not_submitted" },
    submitted: { value: "submitted" },
    under_review: { value: "under_review" },
    approved: { value: "approved" },
    rejected: { value: "rejected" },
    more_info_requested: { value: "more_info_requested" },
  },
});

const SellerTypeEnum = new GraphQLEnumType({
  name: "SellerType",
  values: {
    individual: { value: "individual" },
    business: { value: "business" },
    institutional: { value: "institutional" },
  },
});

const SellerProfileType = new GraphQLObjectType({
  name: "SellerProfile",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    userId: { type: new GraphQLNonNull(GraphQLID) },
    sellerType: { type: new GraphQLNonNull(SellerTypeEnum) },
    displayName: { type: new GraphQLNonNull(GraphQLString) },
    publicStoreName: { type: GraphQLString },
    // legalName intentionally not exposed (restricted).
    provinceCode: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const SellerVerificationType = new GraphQLObjectType({
  name: "SellerVerification",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    sellerProfileId: { type: new GraphQLNonNull(GraphQLID) },
    status: { type: new GraphQLNonNull(SellerVerificationStatusEnum) },
    submittedAt: { type: GraphQLString },
    reviewedAt: { type: GraphQLString },
    decisionReason: { type: GraphQLString },
    // document_storage_key and reviewer identity intentionally not exposed.
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const SellerVerificationConnection = new GraphQLObjectType({
  name: "SellerVerificationConnection",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(SellerVerificationType))) },
    endCursor: { type: GraphQLString },
  },
});

const ListingConditionEnum = new GraphQLEnumType({
  name: "ListingCondition",
  values: {
    new: { value: "new" },
    like_new: { value: "like_new" },
    used: { value: "used" },
    for_parts: { value: "for_parts" },
    unspecified: { value: "unspecified" },
  },
});

const ListingFulfilmentOptionEnum = new GraphQLEnumType({
  name: "ListingFulfilmentOption",
  values: {
    shipping: { value: "shipping" },
    local_pickup: { value: "local_pickup" },
    both: { value: "both" },
  },
});

const ListingStatusEnum = new GraphQLEnumType({
  name: "ListingStatus",
  values: {
    draft: { value: "draft" },
    pending_review: { value: "pending_review" },
    published: { value: "published" },
    rejected: { value: "rejected" },
    paused: { value: "paused" },
    removed: { value: "removed" },
  },
});

const CategoryType = new GraphQLObjectType({
  name: "Category",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    parentId: { type: GraphQLID },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    isActive: { type: new GraphQLNonNull(GraphQLBoolean) },
    sortOrder: { type: new GraphQLNonNull(GraphQLInt) },
    isPlaceholder: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const ListingType = new GraphQLObjectType({
  name: "Listing",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    sellerProfileId: { type: new GraphQLNonNull(GraphQLID) },
    categoryId: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    condition: { type: new GraphQLNonNull(ListingConditionEnum) },
    fulfilmentOption: { type: new GraphQLNonNull(ListingFulfilmentOptionEnum) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    startingPriceMinor: { type: new GraphQLNonNull(GraphQLString) },
    requestedStartsAt: { type: GraphQLString },
    requestedEndsAt: { type: GraphQLString },
    status: { type: new GraphQLNonNull(ListingStatusEnum) },
    rejectionReason: { type: GraphQLString },
    publishedAt: { type: GraphQLString },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ListingConnection = new GraphQLObjectType({
  name: "ListingConnection",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ListingType))) },
    endCursor: { type: GraphQLString },
  },
});

const PublicCategoryType = new GraphQLObjectType({
  name: "PublicCategory",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    isPlaceholder: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const PublicListingMediaType = new GraphQLObjectType({
  name: "PublicListingMedia",
  fields: {
    altText: { type: GraphQLString },
    sortOrder: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const PublicListingType = new GraphQLObjectType({
  name: "PublicListing",
  fields: {
    slug: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    condition: { type: new GraphQLNonNull(ListingConditionEnum) },
    fulfilmentOption: { type: new GraphQLNonNull(ListingFulfilmentOptionEnum) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    startingPriceMinor: { type: new GraphQLNonNull(GraphQLString) },
    publishedAt: { type: GraphQLString },
    category: { type: new GraphQLNonNull(PublicCategoryType) },
    media: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PublicListingMediaType))) },
  },
});

const SearchSortEnum = new GraphQLEnumType({
  name: "SearchSort",
  values: {
    NEWEST: { value: "NEWEST" },
    PRICE_ASC: { value: "PRICE_ASC" },
    PRICE_DESC: { value: "PRICE_DESC" },
    RELEVANCE: { value: "RELEVANCE" },
  },
});

const NoResultsReasonEnum = new GraphQLEnumType({
  name: "NoResultsReason",
  values: {
    NONE: { value: "NONE" },
    NO_MATCHES: { value: "NO_MATCHES" },
    CATEGORY_EMPTY: { value: "CATEGORY_EMPTY" },
  },
});

// Reuse PublicListingType for search items: only public-safe fields are present.
const SearchResultType = new GraphQLObjectType({
  name: "SearchResult",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PublicListingType))) },
    endCursor: { type: GraphQLString },
    hasMore: { type: new GraphQLNonNull(GraphQLBoolean) },
    noResultsReason: { type: new GraphQLNonNull(NoResultsReasonEnum) },
  },
});

const OrderStatusEnum = new GraphQLEnumType({
  name: "OrderStatus",
  values: {
    awaiting_payment: { value: "awaiting_payment" },
    paid: { value: "paid" },
    processing: { value: "processing" },
    shipped: { value: "shipped" },
    ready_for_pickup: { value: "ready_for_pickup" },
    completed: { value: "completed" },
    cancelled: { value: "cancelled" },
  },
});

const PaymentStatusEnum = new GraphQLEnumType({
  name: "PaymentStatus",
  values: {
    created: { value: "created" },
    captured: { value: "captured" },
    failed: { value: "failed" },
    refunded_partial: { value: "refunded_partial" },
    refunded: { value: "refunded" },
  },
});

const FulfilmentActionEnum = new GraphQLEnumType({
  name: "FulfilmentAction",
  values: {
    start_processing: { value: "start_processing" },
    mark_shipped: { value: "mark_shipped" },
    ready_for_pickup: { value: "ready_for_pickup" },
    complete: { value: "complete" },
  },
});

const ShipmentType = new GraphQLObjectType({
  name: "Shipment",
  fields: {
    method: { type: new GraphQLNonNull(GraphQLString) },
    carrier: { type: GraphQLString },
    trackingNumber: { type: GraphQLString },
  },
});

// Participant-only order type: no provider IDs, webhook payloads, staff notes or other-party user IDs.
const OrderType = new GraphQLObjectType({
  name: "Order",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    status: { type: new GraphQLNonNull(OrderStatusEnum) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    hammerPriceMinor: { type: new GraphQLNonNull(GraphQLString) },
    feeTotalMinor: { type: new GraphQLNonNull(GraphQLString) },
    totalMinor: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
    shippingAddressSnapshot: { type: GraphQLString },
    shipments: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ShipmentType))) },
  },
});

const OrderConnection = new GraphQLObjectType({
  name: "OrderConnection",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(OrderType))) },
    endCursor: { type: GraphQLString },
  },
});

const PaymentType = new GraphQLObjectType({
  name: "PaymentTransaction",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    orderId: { type: new GraphQLNonNull(GraphQLID) },
    status: { type: new GraphQLNonNull(PaymentStatusEnum) },
    amountMinor: { type: new GraphQLNonNull(GraphQLString) },
    capturedAmountMinor: { type: new GraphQLNonNull(GraphQLString) },
    refundedAmountMinor: { type: new GraphQLNonNull(GraphQLString) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const AuctionStatusEnum = new GraphQLEnumType({
  name: "AuctionStatus",
  values: {
    scheduled: { value: "scheduled" },
    active: { value: "active" },
    closed_sold: { value: "closed_sold" },
    closed_unsold: { value: "closed_unsold" },
    cancelled: { value: "cancelled" },
  },
});

const MoneyType = new GraphQLObjectType({
  name: "Money",
  fields: {
    minorUnits: { type: new GraphQLNonNull(GraphQLInt) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const BidType = new GraphQLObjectType({
  name: "Bid",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    amount: { type: new GraphQLNonNull(MoneyType) },
    acceptedAt: { type: new GraphQLNonNull(GraphQLString) },
    // Opaque bidder label only; bidder user id is never exposed (docs/16 §2).
    bidderLabel: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const BidConnectionType = new GraphQLObjectType({
  name: "BidConnection",
  fields: {
    items: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BidType))) },
    endCursor: { type: GraphQLString },
  },
});

const AuctionType = new GraphQLObjectType({
  name: "Auction",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    listingId: { type: new GraphQLNonNull(GraphQLID) },
    status: { type: new GraphQLNonNull(AuctionStatusEnum) },
    currentPrice: { type: new GraphQLNonNull(MoneyType) },
    startingPriceMinor: { type: new GraphQLNonNull(GraphQLInt) },
    startsAt: { type: new GraphQLNonNull(GraphQLString) },
    endsAt: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
    // Public accepted bid history; bidder identities stay opaque (docs/16 §2).
    bids: {
      type: new GraphQLNonNull(BidConnectionType),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: auctionResolvers.Auction.bids,
    },
  },
});

const BidErrorType = new GraphQLObjectType({
  name: "BidError",
  fields: {
    code: { type: GraphQLString },
    message: { type: GraphQLString },
  },
});

const BidResultType = new GraphQLObjectType({
  name: "BidResult",
  fields: {
    accepted: { type: new GraphQLNonNull(GraphQLBoolean) },
    bid: { type: BidType },
    auction: { type: AuctionType },
    error: { type: BidErrorType },
  },
});

const CreateAuctionInput = new GraphQLInputObjectType({
  name: "CreateAuctionInput",
  fields: {
    listingId: { type: new GraphQLNonNull(GraphQLID) },
    startsAt: { type: new GraphQLNonNull(GraphQLString) },
    endsAt: { type: new GraphQLNonNull(GraphQLString) },
    startingPriceMinor: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const PlaceBidInput = new GraphQLInputObjectType({
  name: "PlaceBidInput",
  fields: {
    auctionId: { type: new GraphQLNonNull(GraphQLID) },
    amountMinor: { type: new GraphQLNonNull(GraphQLInt) },
    requestId: { type: new GraphQLNonNull(GraphQLID) },
  },
});

const SetProxyBidInput = new GraphQLInputObjectType({
  name: "SetProxyBidInput",
  fields: {
    auctionId: { type: new GraphQLNonNull(GraphQLID) },
    maxAmountMinor: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const AuthPayload = new GraphQLObjectType({
  name: "AuthPayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    user: { type: UserType },
  },
});

const RegisterPayload = new GraphQLObjectType({
  name: "RegisterPayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    userId: { type: GraphQLID },
    verificationToken: { type: GraphQLString },
    message: { type: GraphQLString },
  },
});

const MessagePayload = new GraphQLObjectType({
  name: "MessagePayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    message: { type: GraphQLString },
  },
});

const AdminHealthType = new GraphQLObjectType({
  name: "AdminHealth",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    scope: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const RegisterInput = new GraphQLInputObjectType({
  name: "RegisterInput",
  fields: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
  },
});
const LoginInput = new GraphQLInputObjectType({
  name: "LoginInput",
  fields: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
  },
});
const ResetPasswordInput = new GraphQLInputObjectType({
  name: "ResetPasswordInput",
  fields: {
    token: { type: new GraphQLNonNull(GraphQLString) },
    newPassword: { type: new GraphQLNonNull(GraphQLString) },
  },
});
const UpdateProfileInput = new GraphQLInputObjectType({
  name: "UpdateProfileInput",
  fields: {
    displayName: { type: GraphQLString },
    bio: { type: GraphQLString },
    provinceCode: { type: GraphQLString },
  },
});
const SellerProfileInput = new GraphQLInputObjectType({
  name: "SellerProfileInput",
  fields: {
    sellerType: { type: new GraphQLNonNull(SellerTypeEnum) },
    displayName: { type: new GraphQLNonNull(GraphQLString) },
    publicStoreName: { type: GraphQLString },
    legalName: { type: GraphQLString },
    provinceCode: { type: new GraphQLNonNull(GraphQLString) },
  },
});
const ReviewSellerVerificationInput = new GraphQLInputObjectType({
  name: "ReviewSellerVerificationInput",
  fields: {
    verificationId: { type: new GraphQLNonNull(GraphQLID) },
    decision: { type: new GraphQLNonNull(SellerVerificationStatusEnum) },
    reason: { type: GraphQLString },
  },
});

const SearchListingsInput = new GraphQLInputObjectType({
  name: "SearchListingsInput",
  fields: {
    query: { type: GraphQLString },
    categorySlug: { type: GraphQLString },
    condition: { type: ListingConditionEnum },
    fulfilmentOption: { type: ListingFulfilmentOptionEnum },
    sort: { type: SearchSortEnum },
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
});

const CategoryListingsInput = new GraphQLInputObjectType({
  name: "CategoryListingsInput",
  fields: {
    query: { type: GraphQLString },
    condition: { type: ListingConditionEnum },
    fulfilmentOption: { type: ListingFulfilmentOptionEnum },
    sort: { type: SearchSortEnum },
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
  },
});

const CheckoutInput = new GraphQLInputObjectType({
  name: "CheckoutInput",
  fields: {
    orderId: { type: new GraphQLNonNull(GraphQLID) },
    acceptedTotalMinor: { type: new GraphQLNonNull(GraphQLString) },
    fulfilmentChoice: { type: new GraphQLNonNull(GraphQLString) },
    requestId: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const FulfilmentInput = new GraphQLInputObjectType({
  name: "FulfilmentInput",
  fields: {
    orderId: { type: new GraphQLNonNull(GraphQLID) },
    action: { type: new GraphQLNonNull(FulfilmentActionEnum) },
    carrier: { type: GraphQLString },
    trackingNumber: { type: GraphQLString },
  },
});

const RefundInput = new GraphQLInputObjectType({
  name: "RefundInput",
  fields: {
    paymentId: { type: new GraphQLNonNull(GraphQLID) },
    amountMinor: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ListingDraftInput = new GraphQLInputObjectType({
  name: "ListingDraftInput",
  fields: {
    categoryId: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    condition: { type: new GraphQLNonNull(ListingConditionEnum) },
    fulfilmentOption: { type: new GraphQLNonNull(ListingFulfilmentOptionEnum) },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    startingPriceMinor: { type: new GraphQLNonNull(GraphQLString) },
    requestedStartsAt: { type: GraphQLString },
    requestedEndsAt: { type: GraphQLString },
  },
});

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    health: {
      type: HealthType,
      resolve: () => ({
        status: "ok",
        service: "aliauction-api",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        redisConfigured: Boolean(process.env.REDIS_URL),
      }),
    },
    phase: {
      type: GraphQLString,
      resolve: () =>
        "Phase 1 MVP: identity, seller verification, and catalogue/listings (Slice 3a in progress). See docs/15-delivery-roadmap.md and docs-implementation/PHASE1_STATUS.md.",
    },
    me: { type: UserType, resolve: identityResolvers.Query.me },
    myProfile: { type: ProfileType, resolve: identityResolvers.Query.myProfile },
    mySessions: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(SessionType))),
      resolve: identityResolvers.Query.mySessions,
    },
    adminHealth: { type: AdminHealthType, resolve: identityResolvers.Query.adminHealth },
    mySellerProfile: { type: SellerProfileType, resolve: sellerResolvers.Query.mySellerProfile },
    mySellerVerification: { type: SellerVerificationType, resolve: sellerResolvers.Query.mySellerVerification },
    pendingSellerVerifications: {
      type: new GraphQLNonNull(SellerVerificationConnection),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: sellerResolvers.Query.pendingSellerVerifications,
    },
    categories: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CategoryType))),
      resolve: catalogueResolvers.Query.categories,
    },
    myListings: {
      type: new GraphQLNonNull(ListingConnection),
      args: {
        status: { type: ListingStatusEnum },
        first: { type: GraphQLInt },
        after: { type: GraphQLString },
      },
      resolve: catalogueResolvers.Query.myListings,
    },
    listing: {
      type: PublicListingType,
      args: { slug: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: catalogueResolvers.Query.listing,
    },
    searchListings: {
      type: new GraphQLNonNull(SearchResultType),
      args: { input: { type: new GraphQLNonNull(SearchListingsInput) } },
      resolve: catalogueResolvers.Query.searchListings,
    },
    categoryListings: {
      type: new GraphQLNonNull(SearchResultType),
      args: {
        slug: { type: new GraphQLNonNull(GraphQLString) },
        input: { type: CategoryListingsInput },
      },
      resolve: catalogueResolvers.Query.categoryListings,
    },
    myOrders: {
      type: new GraphQLNonNull(OrderConnection),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: ordersResolvers.Query.myOrders,
    },
    order: {
      type: new GraphQLNonNull(OrderType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: ordersResolvers.Query.order,
    },
    sellerOrders: {
      type: new GraphQLNonNull(OrderConnection),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: ordersResolvers.Query.sellerOrders,
    },
    ordersAll: {
      type: new GraphQLNonNull(OrderConnection),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: ordersResolvers.Query.ordersAll,
    },
    pendingListingReviews: {
      type: new GraphQLNonNull(ListingConnection),
      args: { first: { type: GraphQLInt }, after: { type: GraphQLString } },
      resolve: catalogueResolvers.Query.pendingListingReviews,
    },
    auction: {
      type: AuctionType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: auctionResolvers.Query.auction,
    },
    auctionForListing: {
      type: AuctionType,
      args: { slug: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: auctionResolvers.Query.auctionForListing,
    },
  },
});

const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: {
    register: {
      type: new GraphQLNonNull(RegisterPayload),
      args: { input: { type: new GraphQLNonNull(RegisterInput) } },
      resolve: identityResolvers.Mutation.register,
    },
    verifyEmail: {
      type: new GraphQLNonNull(MessagePayload),
      args: { token: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: identityResolvers.Mutation.verifyEmail,
    },
    resendVerification: {
      type: new GraphQLNonNull(MessagePayload),
      args: { email: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: identityResolvers.Mutation.resendVerification,
    },
    login: {
      type: new GraphQLNonNull(AuthPayload),
      args: { input: { type: new GraphQLNonNull(LoginInput) } },
      resolve: identityResolvers.Mutation.login,
    },
    logout: { type: new GraphQLNonNull(MessagePayload), resolve: identityResolvers.Mutation.logout },
    requestPasswordReset: {
      type: new GraphQLNonNull(MessagePayload),
      args: { email: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: identityResolvers.Mutation.requestPasswordReset,
    },
    resetPassword: {
      type: new GraphQLNonNull(MessagePayload),
      args: { input: { type: new GraphQLNonNull(ResetPasswordInput) } },
      resolve: identityResolvers.Mutation.resetPassword,
    },
    updateMyProfile: {
      type: new GraphQLNonNull(ProfileType),
      args: { input: { type: new GraphQLNonNull(UpdateProfileInput) } },
      resolve: identityResolvers.Mutation.updateMyProfile,
    },
    revokeMySession: {
      type: new GraphQLNonNull(MessagePayload),
      args: { sessionId: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: identityResolvers.Mutation.revokeMySession,
    },
    protectedActionPing: {
      type: new GraphQLNonNull(MessagePayload),
      resolve: identityResolvers.Mutation.protectedActionPing,
    },
    createSellerProfile: {
      type: new GraphQLNonNull(SellerProfileType),
      args: { input: { type: new GraphQLNonNull(SellerProfileInput) } },
      resolve: sellerResolvers.Mutation.createSellerProfile,
    },
    updateSellerProfile: {
      type: new GraphQLNonNull(SellerProfileType),
      args: { input: { type: new GraphQLNonNull(SellerProfileInput) } },
      resolve: sellerResolvers.Mutation.updateSellerProfile,
    },
    submitSellerVerification: {
      type: new GraphQLNonNull(SellerVerificationType),
      resolve: sellerResolvers.Mutation.submitSellerVerification,
    },
    reviewSellerVerification: {
      type: new GraphQLNonNull(SellerVerificationType),
      args: { input: { type: new GraphQLNonNull(ReviewSellerVerificationInput) } },
      resolve: sellerResolvers.Mutation.reviewSellerVerification,
    },
    sellerActionPing: {
      type: new GraphQLNonNull(MessagePayload),
      resolve: sellerResolvers.Mutation.sellerActionPing,
    },
    createListingDraft: {
      type: new GraphQLNonNull(ListingType),
      args: { input: { type: new GraphQLNonNull(ListingDraftInput) } },
      resolve: catalogueResolvers.Mutation.createListingDraft,
    },
    updateListingDraft: {
      type: new GraphQLNonNull(ListingType),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        input: { type: new GraphQLNonNull(ListingDraftInput) },
      },
      resolve: catalogueResolvers.Mutation.updateListingDraft,
    },
    submitListingForReview: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: catalogueResolvers.Mutation.submitListingForReview,
    },
    approveListing: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: catalogueResolvers.Mutation.approveListing,
    },
    rejectListing: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) }, reason: { type: GraphQLString } },
      resolve: catalogueResolvers.Mutation.rejectListing,
    },
    pauseListing: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) }, reason: { type: GraphQLString } },
      resolve: catalogueResolvers.Mutation.pauseListing,
    },
    resumeListing: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: catalogueResolvers.Mutation.resumeListing,
    },
    removeListing: {
      type: new GraphQLNonNull(ListingType),
      args: { id: { type: new GraphQLNonNull(GraphQLID) }, reason: { type: GraphQLString } },
      resolve: catalogueResolvers.Mutation.removeListing,
    },
    createAuction: {
      type: AuctionType,
      args: { input: { type: new GraphQLNonNull(CreateAuctionInput) } },
      resolve: auctionResolvers.Mutation.createAuction,
    },
    placeBid: {
      type: BidResultType,
      args: { input: { type: new GraphQLNonNull(PlaceBidInput) } },
      resolve: auctionResolvers.Mutation.placeBid,
    },
    setProxyBid: {
      type: GraphQLBoolean,
      args: { input: { type: new GraphQLNonNull(SetProxyBidInput) } },
      resolve: auctionResolvers.Mutation.setProxyBid,
    },
    createCheckout: {
      type: new GraphQLNonNull(PaymentType),
      args: { input: { type: new GraphQLNonNull(CheckoutInput) } },
      resolve: ordersResolvers.Mutation.createCheckout,
    },
    recordFulfilment: {
      type: new GraphQLNonNull(OrderType),
      args: { input: { type: new GraphQLNonNull(FulfilmentInput) } },
      resolve: ordersResolvers.Mutation.recordFulfilment,
    },
    refundPayment: {
      type: new GraphQLNonNull(PaymentType),
      args: { input: { type: new GraphQLNonNull(RefundInput) } },
      resolve: ordersResolvers.Mutation.refundPayment,
    },
  },
});

export const schema = new GraphQLSchema({ query: QueryType, mutation: MutationType });
