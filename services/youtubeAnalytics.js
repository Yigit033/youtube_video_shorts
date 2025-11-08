const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class YouTubeAnalyticsService {
  constructor() {
    this.analytics = null;
    this.youtube = null;
    this.isEnabled = process.env.YOUTUBE_ANALYTICS_ENABLED === 'true';
    
    if (this.isEnabled) {
      console.log('📊 YouTube Analytics Service Initialized');
    }
  }

  async initialize(auth) {
    if (!this.isEnabled) return;
    
    try {
      this.analytics = google.youtubeAnalytics({ version: 'v2', auth });
      this.youtube = google.youtube({ version: 'v3', auth });
      console.log('✅ YouTube Analytics API connected');
    } catch (error) {
      console.error('❌ YouTube Analytics initialization failed:', error.message);
    }
  }

  async getVideoAnalytics(videoId, days = 7) {
    if (!this.analytics) return null;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await this.analytics.reports.query({
        ids: 'channel==MINE',
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,averageViewPercentage',
        dimensions: 'video',
        filters: `video==${videoId}`,
        sort: '-views'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching video analytics:', error.message);
      return null;
    }
  }

  async getChannelAnalytics(days = 30) {
    if (!this.analytics) return null;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await this.analytics.reports.query({
        ids: 'channel==MINE',
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'views,likes,comments,shares,subscribersGained,subscribersLost,estimatedMinutesWatched',
        dimensions: 'day',
        sort: 'day'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching channel analytics:', error.message);
      return null;
    }
  }

  async getTopPerformingVideos(days = 30, limit = 10) {
    if (!this.analytics) return [];

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await this.analytics.reports.query({
        ids: 'channel==MINE',
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'views,likes,comments,shares,averageViewPercentage',
        dimensions: 'video',
        sort: '-views',
        maxResults: limit
      });

      if (!response.data.rows) return [];

      // Get video details
      const videoIds = response.data.rows.map(row => row[0]);
      const videoDetails = await this.getVideoDetails(videoIds);

      return response.data.rows.map((row, index) => ({
        videoId: row[0],
        views: row[1],
        likes: row[2],
        comments: row[3],
        shares: row[4],
        averageViewPercentage: row[5],
        title: videoDetails[index]?.title || 'Unknown',
        description: videoDetails[index]?.description || '',
        tags: videoDetails[index]?.tags || []
      }));
    } catch (error) {
      console.error('❌ Error fetching top videos:', error.message);
      return [];
    }
  }

  async getVideoDetails(videoIds) {
    if (!this.youtube || !videoIds.length) return [];

    try {
      const response = await this.youtube.videos.list({
        part: 'snippet',
        id: videoIds.join(',')
      });

      return response.data.items.map(item => ({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        tags: item.snippet.tags || []
      }));
    } catch (error) {
      console.error('❌ Error fetching video details:', error.message);
      return [];
    }
  }

  async extractCommonTopics(topVideos) {
    const topics = {};
    const keywords = {};

    topVideos.forEach(video => {
      // Extract keywords from title
      const titleWords = video.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);

      titleWords.forEach(word => {
        keywords[word] = (keywords[word] || 0) + video.views;
      });

      // Extract topics from tags
      video.tags.forEach(tag => {
        const cleanTag = tag.toLowerCase().replace(/^#+/, '');
        topics[cleanTag] = (topics[cleanTag] || 0) + video.views;
      });
    });

    // Sort by views
    const sortedKeywords = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    const sortedTopics = Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    return {
      keywords: sortedKeywords,
      topics: sortedTopics
    };
  }

  async generateOptimizationReport() {
    if (!this.isEnabled) {
      return { enabled: false, message: 'YouTube Analytics not enabled' };
    }

    console.log('📊 Generating optimization report...');

    try {
      const topVideos = await this.getTopPerformingVideos(30, 20);
      const channelStats = await this.getChannelAnalytics(30);
      const commonTopics = await this.extractCommonTopics(topVideos);

      const report = {
        generated: new Date().toISOString(),
        topVideos: topVideos.slice(0, 5),
        recommendations: {
          topics: commonTopics.topics,
          keywords: commonTopics.keywords,
          avgViewPercentage: this.calculateAverage(topVideos, 'averageViewPercentage'),
          bestPerformingTags: this.extractBestTags(topVideos)
        },
        channelGrowth: {
          totalViews: this.sumMetric(channelStats, 'views'),
          totalLikes: this.sumMetric(channelStats, 'likes'),
          subscribersGained: this.sumMetric(channelStats, 'subscribersGained'),
          watchTime: this.sumMetric(channelStats, 'estimatedMinutesWatched')
        }
      };

      // Save report
      const reportPath = path.join(__dirname, '..', 'temp', 'analytics_report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log('✅ Optimization report saved:', reportPath);

      return report;
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      return { error: error.message };
    }
  }

  extractBestTags(videos) {
    const tagPerformance = {};

    videos.forEach(video => {
      video.tags.forEach(tag => {
        const cleanTag = tag.toLowerCase().replace(/^#+/, '');
        if (!tagPerformance[cleanTag]) {
          tagPerformance[cleanTag] = { count: 0, totalViews: 0 };
        }
        tagPerformance[cleanTag].count++;
        tagPerformance[cleanTag].totalViews += video.views;
      });
    });

    return Object.entries(tagPerformance)
      .map(([tag, data]) => ({
        tag,
        avgViews: Math.round(data.totalViews / data.count),
        frequency: data.count
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 10);
  }

  calculateAverage(items, field) {
    if (!items.length) return 0;
    const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
    return Math.round(sum / items.length);
  }

  sumMetric(data, metric) {
    if (!data || !data.rows) return 0;
    const metricIndex = data.columnHeaders.findIndex(h => h.name === metric);
    if (metricIndex === -1) return 0;
    return data.rows.reduce((sum, row) => sum + (row[metricIndex] || 0), 0);
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  async suggestNextTopics(count = 5) {
    const report = await this.generateOptimizationReport();
    
    if (report.error || !report.recommendations) {
      return ['technology', 'productivity', 'lifestyle', 'health', 'finance'];
    }

    const suggestions = [];
    
    // Combine top topics and keywords
    const combined = [
      ...report.recommendations.topics.slice(0, 3),
      ...report.recommendations.keywords.slice(0, 2)
    ];

    // Add variations
    combined.forEach(topic => {
      suggestions.push(topic);
      suggestions.push(`${topic} tips`);
      suggestions.push(`${topic} guide`);
    });

    return suggestions.slice(0, count);
  }
}

module.exports = new YouTubeAnalyticsService();
