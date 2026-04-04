import 'tools/just/docs-sync.just'
import '../standards/templates/repo-files/standards-sync.just'

bs:
    pnpm build:web && pnpm start