FROM node:24-alpine

RUN apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY . .

EXPOSE 5001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
