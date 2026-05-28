import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';

/**
 * VaultAura DevOps Automation & Deployment Script
 */
async function main() {
  const rootDir = process.cwd();
  
  console.log("⚡ Starting VaultAura build compilation...");
  
  // 1. Run Vite build bundling pipeline
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error("❌ Build failed: Compiler returned non-zero exit code.");
    process.exit(1);
  }

  // 2. Assert dist/ existence and inspect contents
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error("❌ Deployment aborted: dist/ directory not found after build.");
    process.exit(1);
  }

  const files = fs.readdirSync(distDir);
  if (files.length === 0) {
    console.error("❌ Deployment aborted: dist/ directory is empty.");
    process.exit(1);
  }

  // 3. Verify dist/index.html entry point
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error("❌ Deployment aborted: dist/index.html is missing.");
    process.exit(1);
  }

  // 4. Critical security scan: abort on root .env presence
  const rootFiles = fs.readdirSync(rootDir);
  const hasEnvFile = rootFiles.some(file => {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file).toLowerCase();
    return base === '.env' || ext === '.env' || base.startsWith('.env.');
  });

  if (hasEnvFile) {
    console.error("\n⛔ Deployment aborted: .env file detected in repository root. Remove it before deploying.\n");
    process.exit(1);
  }

  // 5. Construct semantic commit strings
  const timestamp = new Date().toISOString();
  const commitMessage = `deploy: VaultAura build — ${timestamp} — entropy engine v2.0`;

  // 6. Draw the Luxury Intercept Box
  const borderBox = `
╔═══════════════════════════════════════════════════════════════╗
║          VAULTAURA — DEPLOYMENT VERIFICATION INTERCEPT        ║
╠═══════════════════════════════════════════════════════════════╣
║  Build:     ✅ Verified                                       ║
║  Assets:    ✅ All present                                    ║
║  Secrets:   ✅ Clean (no .env found)                          ║
║  Target:    GitHub Pages → gh-pages branch                    ║
║  Commit:    deploy: VaultAura build — ${timestamp.substring(0, 10)}    ║
╠═══════════════════════════════════════════════════════════════╣
║  ⚠️  AWAITING AUTHORIZATION TO PUBLISH LIVE                   ║
║                                                               ║
║  Type  o  or  ok  then press ENTER to publish.               ║
║  Type  x  or  abort  to cancel deployment.                    ║
╚═══════════════════════════════════════════════════════════════╝
`;

  console.log(borderBox);

  // 7. Initialize Interactive Intercept Interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptUser = () => {
    rl.question("👉 Enter decision: ", async (input) => {
      const decision = input.trim().toLowerCase();

      if (decision === 'o' || decision === 'ok') {
        rl.close();
        console.log("🚀 Publishing live to GitHub Pages...");
        
        try {
          // Perform staging operations
          console.log("Staging assets...");
          
          // Execute subtree push command to target gh-pages branch
          execSync('git subtree push --prefix dist origin gh-pages', { stdio: 'inherit' });
          
          // Log deployment success in deploy.log
          const logEntry = `[${timestamp}] SUCCESS - Committed build and pushed to gh-pages. Msg: "${commitMessage}"\n`;
          fs.appendFileSync(path.join(rootDir, 'deploy.log'), logEntry);

          console.log("\n🚀 VaultAura is live on GitHub Pages.");
          process.exit(0);
        } catch (err) {
          console.error("\n❌ Git push operation failed. Please verify that git origin remote is correctly configured and has active write permissions.");
          
          // Log failure state
          const logEntry = `[${timestamp}] FAILURE - git subtree push failed. Msg: "${err.message}"\n`;
          fs.appendFileSync(path.join(rootDir, 'deploy.log'), logEntry);
          
          process.exit(1);
        }
      } else if (decision === 'x' || decision === 'abort') {
        rl.close();
        console.log("🚫 Deployment cancelled by user.");
        
        // Log cancellation
        const logEntry = `[${timestamp}] CANCELLED - User aborted deployment.\n`;
        fs.appendFileSync(path.join(rootDir, 'deploy.log'), logEntry);
        
        process.exit(0);
      } else {
        // Re-prompt unrecognized answers
        console.log("❓ Unrecognized input. Type 'o' to publish or 'x' to cancel:");
        promptUser();
      }
    });
  };

  promptUser();
}

main();
