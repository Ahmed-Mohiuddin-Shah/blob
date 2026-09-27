FROM node:22-alpine
WORKDIR /app
COPY proxy.js .
ENV NODE_ENV=production
EXPOSE 11435
CMD ["node", "proxy.js"]
