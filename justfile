# OPTCG DB — task runner

# Build for production
build:
	cd app && npm run build

# Start dev server
dev:
	cd app && npm run dev

# Lint
lint:
	cd app && npm run lint

# Pull latest punk-records, re-seed DB, and copy to app
seed:
	cd vendor/punk-records && git pull
	python3 seed.py --clean
	cp optcg.db app/public/optcg.db

# Copy existing DB to app (after manual re-seed)
cpdb:
	cp optcg.db app/public/optcg.db
