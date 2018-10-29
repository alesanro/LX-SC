SHELL = /bin/bash -O extglob -c

include .env

PUBLISH_BRANCH?=develop
RELEASE_BRANCH=release
CURRENT_GIT_BRANCH:=$(shell git symbolic-ref --short HEAD)
CURRENT_GIT_TAGS:=$(shell git tag -l --points-at HEAD)
PACKAGE_VERSION:=$(shell node -pe "require('./package.json').version")

.DEFAULT_GOAL: help
.PHONY: generate_ts compile recompile_ts lint.js lint.sol lint.ts lint run_testrpc release_internal release_cleanup

help: ## Shows 'help' description for available targets.
	@IFS=$$'\n' ; \
    help_lines=(`fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//'`); \
    for help_line in $${help_lines[@]}; do \
        IFS=$$'#' ; \
        help_split=($$help_line) ; \
        help_command=`echo $${help_split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        help_info=`echo $${help_split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        printf "\033[36m%-30s\033[0m %s\n" $$help_command $$help_info ; \
    done


compile: ## Incremental compilation. Compiles contracts and generate updated interfaces
	npx truffle compile

compile.all: ## Full compilation. Compiles all contracts and generate updated interfaces
	npx truffle compile

lint.sol: ## Lints *.sol files
	npx solium --dir contracts

lint.js: ## Lints *.js files
	npx eslint .

lint: lint.sol lint.js ## Lints all kind of files: *.sol, *.js

lint.sol.fix: ## Lints *.sol files  and fixes them
	npx solium --dir contracts --fix

lint.js.fix: ## Lints *.js files and fixes them
	npx eslint . --fix

lint.fix: lint.sol.fix lint.js.fix ## Lints all kind of files: *.sol, *.js and fixes them where possible

run_testrpc: ## Runs testrpc from scripts
	npx ganache-cli -g 1 --gasLimit 8000000 --trace_request true | grep -Ev "FilterSubprovider|eth_getFilterChanges"

release_start: ## Start from this command when ready to release
	@if [[ "$(CURRENT_GIT_BRANCH)" != "$(PUBLISH_BRANCH)" ]]; then \
		echo "Invalid branch to start public. Branch to start: '$(PUBLISH_BRANCH)'"; \
		exit 3; \
	else \
		echo "Current branch is '$(PUBLISH_BRANCH)'. OK for publishing. Continue..."; \
	fi; \
	git checkout -b $(RELEASE_BRANCH); \
	

release_finish: ## Intended to make final chagnes to release process
	@if [[ "$(CURRENT_GIT_BRANCH)" != "$(RELEASE_BRANCH)" ]]; then \
		echo "Invalid branch to continue release. Branch to continue: '$(RELEASE_BRANCH)'"; \
		exit 3; \
	else \
		echo "Current branch is '$(RELEASE_BRANCH)'. OK for publishing. Continue..."; \
	fi; \
	git push origin $(RELEASE_BRANCH); \
	npm run release -- --dry-run; \
	@read -p "Is all okay? Could we continue publishing (yes to continue): " publish_answer; \
	if [[ $${publish_answer} != "yes" ]]; then \
		$(MAKE) release_cleanup; \
		echo "Break publishing. Abort."; \
		exit 1; \
	fi; \
	npm run release; \

	$(MAKE) release_after
	$(MAKE) release_cleanup

	@echo "Package published successfully!"

release_cleanup: ## Cleanup after release_internal
	@echo "Release cleanup..."; \
	git checkout $(PUBLISH_BRANCH); \
	git branch -D $(RELEASE_BRANCH); \
	git branch -rD $(RELEASE_BRANCH); \
	git push origin :$(RELEASE_BRANCH)
	echo "Done."; \

release_after:
	@if [[ "$(CURRENT_GIT_BRANCH)" != "$(RELEASE_BRANCH)" ]]; then \
		echo "Invalid branch to finish release. Branch to finish: 'release'"; \
		exit 3; \
	fi; \
	release_version=$(PACKAGE_VERSION); \
	git push origin $(RELEASE_BRANCH); \
	git checkout $(PUBLISH_BRANCH); \
	git merge --no-ff release -e -m "Merge from 'release-v$${release_version}'"; \
	git push origin $(PACKAGE_VERSION) --tags; \
	@read -p "Should we release to 'master' branch too? " publish_answer; \
	if [[ $${publish_answer} != "yes" ]]; then \
		echo "Good. Do it manually if needed. Done!"; \
		exit 1; \
	fi; \
	git checkout master; \
	git merge --no-ff release -e -m "Release v$${release_version}"; \
	git tag "v$${release_version}"; \
	git push origin develop; \
	git push origin master --tags; \
