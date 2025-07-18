import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({ 
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'session' // Use singular name to match connect-pg-simple default
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy (Email/Password)
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google Strategy
  const getCallbackURL = () => {
    const domain = process.env.REPLIT_DOMAINS || 'localhost:5000';
    return `https://${domain}/api/auth/google/callback`;
  };

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: getCallbackURL(),
        passReqToCallback: true // This allows us to access the request object
      },
      async (req: any, accessToken, refreshToken, profile, done) => {
        try {
          console.log("Google OAuth callback received:");
          console.log("- Profile ID:", profile.id);
          console.log("- Email:", profile.emails?.[0]?.value);
          console.log("- Access Token:", accessToken ? "Present" : "Missing");
          console.log("- Refresh Token:", refreshToken ? "Present" : "Missing");
          console.log("- Request query:", req.query);
          
          // If no refresh token and user is forcing consent, log warning
          if (!refreshToken && req.query.state === 'force_consent') {
            console.warn("WARNING: Force consent requested but no refresh token received from Google");
          }
          
          let user = await storage.getUserByGoogleId(profile.id);
          
          if (!user) {
            // Check if user exists by email
            user = await storage.getUserByEmail(profile.emails?.[0]?.value || "");
            
            if (user) {
              // Link Google account to existing user
              console.log("Linking Google account to existing user:", user.email);
              user = await storage.updateUser(user.id, {
                googleId: profile.id,
                googleAccessToken: accessToken,
                googleRefreshToken: refreshToken,
              });
            } else {
              // Create new user
              console.log("Creating new user from Google profile");
              user = await storage.createUser({
                email: profile.emails?.[0]?.value || "",
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileImageUrl: profile.photos?.[0]?.value,
                googleId: profile.id,
              });
              
              user = await storage.updateUser(user.id, {
                googleAccessToken: accessToken,
                googleRefreshToken: refreshToken || user.googleRefreshToken, // Keep existing if not provided
              });
            }
          } else {
            // Update tokens
            console.log("Updating tokens for existing Google user:", user.email);
            user = await storage.updateUser(user.id, {
              googleAccessToken: accessToken,
              googleRefreshToken: refreshToken || user.googleRefreshToken, // Keep existing if not provided
            });
          }
          
          console.log(`Google OAuth: Final user state for ${user.email}`);
          console.log(`- User ID: ${user.id}`);
          console.log(`- Access Token: ${user.googleAccessToken ? 'Present' : 'Missing'}`);
          console.log(`- Refresh Token: ${user.googleRefreshToken ? 'Present' : 'Missing'}`);
          
          // Force refresh token issue if missing
          if (!refreshToken && !user.googleRefreshToken) {
            console.warn("WARNING: No refresh token provided by Google. User may need to re-authorize.");
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(null, false);
    }
  });

  // Routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ 
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    const user = req.user as User;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    });
  });

  app.get("/api/auth/google", passport.authenticate("google", { 
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"] 
  }));

  app.get("/api/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.user as User;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    });
  });
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}