const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tempDir = path.join(__dirname, 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const app = express();
const port = process.env.PORT || 3000;

// Enhanced getResolutions endpoint to get all available formats
app.get('/getResolutions', async (req, res) => {
  const { videoUrl } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing videoUrl parameter' });
  }

  try {
    // Get detailed format information
    const command = `yt-dlp -J "${videoUrl}"`;
    const output = execSync(command, { encoding: 'utf8' });
    const videoInfo = JSON.parse(output);

    // Filter and process formats
    const formats = videoInfo.formats
      .filter(format => 
        // Only include formats with both video and audio
        format.vcodec !== 'none' && 
        format.acodec !== 'none' &&
        format.ext === 'mp4'  // Only MP4 formats
      )
      .map(format => ({
        format_id: format.format_id,
        quality: `${format.height}p`,
        filesize: format.filesize,
        fps: format.fps,
        vcodec: format.vcodec,
        acodec: format.acodec,
        ext: format.ext,
        // Convert bytes to MB for readable size
        size: format.filesize ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'
      }))
      // Sort by height (quality) in descending order
      .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

    res.json({
      formats,
      title: videoInfo.title,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching video information' });
  }
});

// Enhanced download endpoint for specific format
app.get('/download', async (req, res) => {
  const { videoUrl, format_id } = req.query;
  
  if (!videoUrl || !format_id) {
    return res.status(400).send('Missing required parameters');
  }

  const tempFilePath = path.join(tempDir, `video_${Date.now()}.mp4`);

  try {
    console.log('Starting download for:', videoUrl);

    const command = `yt-dlp -f ${format_id} \
      --force-ipv4 \
      --geo-bypass \
      --no-warnings \
      --prefer-ffmpeg \
      --output "${tempFilePath}" \
      "${videoUrl}"`;

    console.log('Executing command:', command);
    execSync(command);

    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Download failed - file not created');
    }

    const stats = fs.statSync(tempFilePath);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video_${Date.now()}.mp4"`);

    const stream = fs.createReadStream(tempFilePath);
    
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      cleanup();
      if (!res.headersSent) {
        res.status(500).send('Error streaming video');
      }
    });

    stream.on('end', cleanup);
    stream.pipe(res);

    function cleanup() {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }

    req.on('close', () => {
      stream.destroy();
      cleanup();
    });

  } catch (error) {
    console.error('Download Error:', error);
    if (!res.headersSent) {
      res.status(500).send(`Error downloading video: ${error.message}`);
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
