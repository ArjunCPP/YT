FROM node:18

# Install system dependencies and create python virtual environment
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install yt-dlp in virtual environment
RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Create temp directory for downloads
RUN mkdir temp

# Bundle app source
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD [ "node", "server.js" ]