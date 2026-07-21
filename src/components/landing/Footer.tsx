export function Footer() {
  return (
    <footer className="bg-gray-900 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm text-gray-400">
          Decipher Ranker — powered by x402
        </span>
        <div className="flex items-center gap-6">
          <a
            href="/openapi.json"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            OpenAPI spec
          </a>
          <a
            href="/llms.txt"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            llms.txt
          </a>
          <a
            href="https://github.com/zaryab2000/decipher-ranker/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://decipherclub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Decipher Club
          </a>
        </div>
      </div>
    </footer>
  );
}
