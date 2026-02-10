import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

/* ── Usage (Valuator-specific: simple free-use counter) ── */
const UsageSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    freeUsed: { type: Number, required: true, default: 0 },
    paid: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

/* ── User (shared with prod_vitruviai — same schema, same DB) ── */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    avatar: { type: String, default: null },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ["user", "associate", "vendor", "buyer", "admin", "superadmin"],
      default: "user",
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    refreshTokens: [
      {
        token: String,
        expiresAt: Date,
        device: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    passwordResetToken: String,
    passwordResetExpires: Date,
    verificationToken: String,
    verificationExpires: Date,
    lastLogin: Date,
    preferences: {
      notifications: { type: Boolean, default: true },
      emailUpdates: { type: Boolean, default: true },
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    },
    company: {
      name: String,
      address: String,
      license: String,
      gstin: String,
      website: String,
    },
    specializations: [String],
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    wishlist: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, refPath: "wishlist.itemType" },
        itemType: { type: String, enum: ["Design", "Service"], required: true },
        title: String,
        savedAt: { type: Date, default: Date.now },
      },
    ],
    subscription: {
      plan: { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
      status: { type: String, enum: ["active", "canceled", "expired"], default: "active" },
      startDate: { type: Date, default: Date.now },
      endDate: Date,
    },
    associateProfile: {
      tagline: { type: String, maxlength: 150, trim: true },
      bio: { type: String, maxlength: 2000, trim: true },
      experience: {
        years: { type: Number, min: 0 },
        description: { type: String, maxlength: 500 },
      },
      portfolio: [
        {
          title: { type: String, required: true, maxlength: 200, trim: true },
          description: { type: String, maxlength: 1000, trim: true },
          category: {
            type: String,
            enum: ["Residential", "Commercial", "Mixed-Use", "Institutional", "Industrial", "Infrastructure", "Service Project", "Consulting Project"],
          },
          images: [String],
          thumbnail: String,
          projectDate: Date,
          client: { type: String, maxlength: 200, trim: true },
          location: { type: String, maxlength: 200, trim: true },
          budget: Number,
          tags: [{ type: String, lowercase: true, trim: true }],
          featured: { type: Boolean, default: false },
          order: { type: Number, default: 0 },
        },
      ],
      offers: [
        {
          title: { type: String, required: true, maxlength: 200, trim: true },
          description: { type: String, maxlength: 1000, trim: true },
          category: { type: String, enum: ["Rendering", "Consulting", "Technical", "Design", "Planning", "Other"] },
          pricing: {
            type: { type: String, enum: ["fixed", "hourly", "per_unit"], default: "fixed" },
            amount: { type: Number, required: true, min: 0 },
            unit: { type: String, trim: true },
          },
          deliveryTime: { type: String, trim: true },
          features: [{ type: String, trim: true }],
          active: { type: Boolean, default: true },
          order: { type: Number, default: 0 },
        },
      ],
      bundles: [
        {
          name: { type: String, required: true, maxlength: 200, trim: true },
          description: { type: String, maxlength: 1000, trim: true },
          bundleType: { type: String, enum: ["multi_service", "tiered", "time_based", "custom_project"], required: true },
          includedOffers: [{ offerId: mongoose.Schema.Types.ObjectId, quantity: { type: Number, default: 1, min: 1 } }],
          tiers: [
            {
              name: { type: String, required: true, trim: true },
              price: { type: Number, required: true, min: 0 },
              deliveryTime: { type: String, trim: true },
              features: [{ type: String, trim: true }],
              maxRevisions: { type: Number, min: 0 },
              popular: { type: Boolean, default: false },
            },
          ],
          timeBased: {
            duration: { type: String, enum: ["weekly", "monthly", "quarterly", "annual"] },
            hoursIncluded: { type: Number, min: 0 },
            price: { type: Number, min: 0 },
            rolloverHours: { type: Boolean, default: false },
          },
          customProject: {
            basePrice: { type: Number, min: 0 },
            priceUnit: { type: String, trim: true },
            minimumEngagement: { type: Number, min: 0 },
            estimatedTimeframe: { type: String, trim: true },
            scopeOfWork: [{ type: String, trim: true }],
          },
          discount: { type: { type: String, enum: ["percentage", "fixed"] }, value: { type: Number, min: 0 } },
          active: { type: Boolean, default: true },
          order: { type: Number, default: 0 },
        },
      ],
      consulting: {
        enabled: { type: Boolean, default: true },
        description: { type: String, maxlength: 500, trim: true },
        sessionTypes: [
          { name: { type: String, trim: true }, duration: { type: Number, min: 15 }, price: { type: Number, min: 0 }, description: { type: String, maxlength: 500, trim: true } },
        ],
      },
      availability: {
        enabled: { type: Boolean, default: true },
        timezone: { type: String, default: "UTC", trim: true },
        workingDays: [{ type: Number, min: 0, max: 6 }],
        workingHours: { start: { type: String, default: "09:00", trim: true }, end: { type: String, default: "17:00", trim: true } },
        blockedDates: [Date],
        bufferMinutes: { type: Number, default: 15, min: 0 },
      },
      reviews: [
        {
          reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          rating: { type: Number, required: true, min: 1, max: 5 },
          title: { type: String, maxlength: 100, trim: true },
          content: { type: String, maxlength: 1000, trim: true },
          projectType: { type: String, enum: ["Rendering", "Consulting", "Technical", "Design", "Planning", "Other"], trim: true },
          helpful: { type: Number, default: 0, min: 0 },
          verified: { type: Boolean, default: false },
          response: { content: { type: String, maxlength: 500, trim: true }, respondedAt: Date },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      skills: [{ type: String, trim: true }],
      software: [{ type: String, trim: true }],
      certifications: [{ name: { type: String, trim: true }, issuer: { type: String, trim: true }, year: { type: Number, min: 1900, max: 2100 }, credentialUrl: { type: String, trim: true } }],
      socialLinks: { website: { type: String, trim: true }, linkedin: { type: String, trim: true }, behance: { type: String, trim: true }, instagram: { type: String, trim: true }, youtube: { type: String, trim: true } },
      profileSlug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
      featured: { type: Boolean, default: false },
      profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
    },
    associateAnalytics: {
      totalViews: { type: Number, default: 0 },
      totalInquiries: { type: Number, default: 0 },
      totalAppointments: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      lastViewDate: Date,
      lastInquiryDate: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.verificationToken;
        delete ret.verificationExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ "associateProfile.featured": 1 });
UserSchema.index({ "associateProfile.skills": 1 });
UserSchema.index({ role: 1, isActive: 1, "associateProfile.featured": 1 });

UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidate: string) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const Usage = mongoose.models.Usage ?? mongoose.model("Usage", UsageSchema);
export const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
