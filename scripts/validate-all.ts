/**
 * Run all validation scripts
 *
 * Usage: npx ts-node scripts/validate-all.ts <subgraph-endpoint>
 */

import { execSync } from 'child_process';
import path from 'path';

interface ValidationRun {
  name: string;
  script: string;
  passed: boolean;
  error?: string;
}

function runValidation(name: string, script: string, endpoint: string): ValidationRun {
  const scriptPath = path.join(__dirname, script);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log('='.repeat(60));

  try {
    execSync(`npx ts-node ${scriptPath} "${endpoint}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    return { name, script, passed: true };
  } catch (error: any) {
    return {
      name,
      script,
      passed: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function main(): Promise<void> {
  const endpoint = process.argv[2];

  if (!endpoint) {
    console.error('Usage: npx ts-node scripts/validate-all.ts <subgraph-endpoint>');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node scripts/validate-all.ts https://api.studio.thegraph.com/query/.../polymarket-subgraph/v0.0.1');
    process.exit(1);
  }

  console.log('🚀 Running all validations');
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`📅 Time: ${new Date().toISOString()}\n`);

  const validations = [
    { name: 'Count Validation', script: 'validate-counts.ts' },
    { name: 'Trade Validation', script: 'validate-trades.ts' },
    { name: 'Gamma API Validation', script: 'validate-gamma.ts' },
  ];

  const results: ValidationRun[] = [];

  for (const validation of validations) {
    const result = runValidation(validation.name, validation.script, endpoint);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`      Error: ${result.error.slice(0, 100)}`);
    }

    if (result.passed) passed++;
    else failed++;
  }

  console.log(`\nTotal: ${passed}/${results.length} validations passed\n`);

  // Quality gates
  console.log('Quality Gates:');
  console.log('─'.repeat(40));

  const gates = [
    { name: 'All validations pass', passed: failed === 0 },
    { name: 'Event parity', passed: results.find(r => r.name === 'Count Validation')?.passed ?? false },
    { name: 'Trade integrity', passed: results.find(r => r.name === 'Trade Validation')?.passed ?? false },
    { name: 'Gamma alignment', passed: results.find(r => r.name === 'Gamma API Validation')?.passed ?? false },
  ];

  for (const gate of gates) {
    const status = gate.passed ? '✅' : '❌';
    console.log(`${status} ${gate.name}`);
  }

  console.log('');

  if (failed > 0) {
    console.log('❌ VALIDATION FAILED');
    process.exit(1);
  } else {
    console.log('✅ ALL VALIDATIONS PASSED');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
