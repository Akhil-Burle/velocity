/**
 * db/connection.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose connection singleton. Called once at startup via connectDB().
 * Guards against reconnecting if already connected.
 */

const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Node.js querySrv ECONNREFUSED on Windows/VPN configurations
// Node.js's dns.resolveSrv bypasses OS name resolution and directly queries the DNS servers returned by dns.getServers().
// If that returns only 127.0.0.1 (common when IPv6 is active or Windows dns api returns loopback fallback),
// dns queries fail on port 53. We fall back to public DNS resolvers in this case.
try {
  const servers = dns.getServers();
  const onlyLoopback = !servers.length ||
    servers.every(s => s === '127.0.0.1' || s === '::1' || s.startsWith('127.'));
  if (onlyLoopback) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch (e) {
  // Silent catch in case dns.setServers is restricted or fails
}

let _connected = false;

async function connectDB() {
  if (_connected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri || uri === 'your_mongodb_uri_here') {
    console.warn('  ⚠️  MONGODB_URI not set — MongoDB features disabled (in-memory fallback active)');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS:         15000,
      family: 4,                       // force IPv4 — avoids IPv6 ECONNREFUSED on Windows
    });
    _connected = true;
    console.log('  ✅ MongoDB Atlas connected');
  } catch (err) {
    console.error('  ❌ MongoDB connection failed:', err.message);
    console.warn('     Continuing with in-memory store as fallback');
  }
}

function isConnected() {
  return _connected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isConnected };
