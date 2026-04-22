#!/bin/bash
grep -R "ERR_MODULE_NOT_FOUND\|Cannot find module" -n /var/log/tradereplay/*error.log | tail -40
