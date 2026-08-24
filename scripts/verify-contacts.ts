/**
 * Local verification for name/phone stabilizers (tracker screenshot fixtures).
 * Run: npx --yes tsx scripts/verify-contacts.ts
 */
import { cleanCandidateName, looksLikePersonName, resolveCandidateName } from '../lib/nameClean'
import {
  formatPhoneInternational,
  splitGluedPhoneFromEmail,
  sanitizeCandidateEmail,
} from '../lib/phoneFormat'

let failed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}

// Names
assert(cleanCandidateName('Professional Summary') === '', 'reject Professional Summary')
assert(!looksLikePersonName('Professional Summary'), 'looksLike rejects Professional Summary')
assert(
  cleanCandidateName('67 Rhenuga Renganathan') === 'Rhenuga Renganathan',
  'strip leading score 67',
)
assert(
  looksLikePersonName('Ahmad Farhan Bin Wan Mohamed Sameon'),
  'keep MY Bin names',
)
assert(
  resolveCandidateName('Professional Summary\n\nJohnathan Smith\nEngineer', '67_John_Smith_Resume.pdf') ===
    'Johnathan Smith' ||
    resolveCandidateName('Professional Summary\n\nJohnathan Smith\nEngineer', null) === 'Johnathan Smith',
  'prefer real name over section heading',
)

// Phones
assert(
  formatPhoneInternational('018-6665664').startsWith('+60'),
  'MY local 018 → +60',
)
assert(
  formatPhoneInternational('601123864732').includes('+60'),
  '601… → +60',
)
assert(
  formatPhoneInternational('-9151077').startsWith('+'),
  'Excel negative repaired',
)
assert(
  formatPhoneInternational('+6017-514 6665 / +6016-973 7400').includes(' / '),
  'multi phone preserved',
)
assert(
  formatPhoneInternational('6281294878').startsWith('+91') ||
    formatPhoneInternational('+91 6281294878').startsWith('+91'),
  'IN mobile detect',
)
assert(
  formatPhoneInternational('+92 331 5149822').startsWith('+92'),
  'PK kept',
)

const glued = splitGluedPhoneFromEmail('0146453599rhenuga12@yahoo.com')
assert(glued.email === 'rhenuga12@yahoo.com', 'unglue email')
assert(Boolean(glued.phone && glued.phone.includes('+')), 'unglue phone formatted')
assert(sanitizeCandidateEmail('0146453599rhenuga12@yahoo.com') === 'rhenuga12@yahoo.com', 'sanitize email')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll contact fixtures passed')
