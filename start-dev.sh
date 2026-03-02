#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   🚀 Starting Reina Chura Dev Servers   ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env files exist
if [ ! -f "api/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: api/.env not found!${NC}"
    echo "   Create it from api/.env.example"
    echo ""
fi

if [ ! -f "src/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: src/.env not found!${NC}"
    echo "   Make sure it has ImageKit variables"
    echo ""
fi

echo -e "${BLUE}Starting backend API...${NC}"
cd api
npm run dev &
BACKEND_PID=$!
cd ..

sleep 2

echo ""
echo -e "${BLUE}Starting frontend...${NC}"
cd src
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ✅ Both servers started!               ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Backend:  ${NC}http://localhost:3001"
echo -e "${BLUE}Frontend: ${NC}http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for Ctrl+C
wait
