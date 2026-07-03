import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * download-caddy.js
 * 
 * This script downloads the Caddy binary with the DuckDNS plugin for Windows x64.
 * It uses the official Caddy download API to fetch a custom build.
 * 
 * Philosophy: Zero-config, automated infrastructure.
 */

async function downloadCaddy() {
    const targetPath = path.join(process.cwd(), 'caddy.exe');
    
    console.log('Checking for Caddy binary...');

    // Caddy download URL for Windows x64 with DuckDNS plugin
    // Using the official Caddy download API: https://caddyserver.com/download
    const downloadUrl = 'https://caddyserver.com/api/download?os=windows&arch=amd64&p=github.com/caddy-dns/duckdns';

    try {
        console.log(`Downloading Caddy with DuckDNS plugin from: ${downloadUrl}...`);
        
        // Use curl to download the binary (available on Windows 10+)
        execSync(`curl -L "${downloadUrl}" -o "${targetPath}"`);
        
        console.log(`✅ Caddy binary successfully downloaded to: ${targetPath}`);
    } catch (error) {
        console.error('❌ Error downloading Caddy binary:');
        console.error(error.message);
        process.exit(1);
    }
}

downloadCaddy();