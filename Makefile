# Vimbra top-level entry points. Each target runs the matching npm script from
# overlay/package.json, so `cd overlay && npm run <script>` works the same where
# make isn't available (e.g. Windows).
NPM := cd overlay && npm run

# Surfer's macOS icon step breaks on Node 25+ (see .nvmrc); use a Node 22 keg when installed.
NODE22 := $(firstword $(wildcard /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin))
ifneq ($(NODE22),)
export PATH := $(NODE22):$(PATH)
endif

.PHONY: help doctor deps download bootstrap import status build build-ui update run

help:
	@echo "make doctor     check this machine can build Vimbra"
	@echo "make deps       install Surfer (pinned) into overlay/node_modules"
	@echo "make download   fetch pinned Firefox source into overlay/engine/"
	@echo "make bootstrap  mach bootstrap (interactive; installs build deps)"
	@echo "make import     apply overlay/src (files + patches) onto engine/"
	@echo "make status     show what differs between engine/ and stock Firefox"
	@echo "make build      compile (tens of minutes to hours the first time)"
	@echo "make build-ui   rebuild front-end (JS/CSS/XHTML) changes only"
	@echo "make update     move engine/ to the latest Firefox release"
	@echo "make run        launch the built browser"

doctor:
	@./build/doctor.sh

deps:
	$(NPM) deps

download:
	$(NPM) download

bootstrap:
	$(NPM) bootstrap

import:
	$(NPM) import

status:
	$(NPM) status

build:
	$(NPM) build

build-ui:
	$(NPM) build:ui

update:
	$(NPM) update

run:
	$(NPM) start
