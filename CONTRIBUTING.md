# Contributing to Orpheus

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/collectif-pixel/orpheus
cd orpheus
bun install
```

## Running Locally

```bash
# Development mode
bun run dev <command>

# Build binary
bun run build
```

## Project Structure

```
src/
├── cli/           # CLI commands and UI
├── core/          # Business logic (config, daemon, media detection)
├── server/        # HTTP server with SSE
└── themes/        # Built-in default theme
```

## Creating a Theme

Themes are single HTML files that connect to the SSE endpoint:

1. Create a new repository with `theme.html`
2. Add `package.json` with theme metadata
3. Users install with `orpheus add @username/theme-name`

See [orpheus-theme-template](https://github.com/Collectif-Pixel/orpheus-theme-template) for a starter.

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `bun run dev`
5. Submit a PR

## Code Style

- TypeScript with strict mode
- No unnecessary comments
- 2 spaces indentation
- Single quotes for strings

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
