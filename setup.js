const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_FILE = path.join(__dirname, '.env');
const ENV_EXAMPLE = path.join(__dirname, '.env.example');

// Check if .env exists
if (fs.existsSync(ENV_FILE)) {
  console.log('✅ .env file already exists');
  process.exit(0);
}

console.log('🎬 Setting up YouTube Shorts Automation Platform\n');

// Copy .env.example to .env if it doesn't exist
if (!fs.existsSync(ENV_EXAMPLE)) {
  console.error('❌ .env.example file not found');
  process.exit(1);
}

// Read questions
const questions = [
  {
    name: 'YOUTUBE_CLIENT_ID',
    message: 'Enter your YouTube API Client ID:',
    required: true
  },
  {
    name: 'YOUTUBE_CLIENT_SECRET',
    message: 'Enter your YouTube API Client Secret:',
    required: true
  },
  {
    name: 'PEXELS_API_KEY',
    message: 'Enter your Pexels API Key (get one at https://www.pexels.com/api/new/):',
    required: true
  },
  {
    name: 'HUGGINGFACE_API_KEY',
    message: 'Enter your HuggingFace API Key (optional, press Enter to skip):',
    required: false
  },
  {
    name: 'PORT',
    message: 'Enter the port number (default: 3000):',
    default: '3000'
  }
];

// Ask questions and collect answers
const askQuestion = (index, answers = {}) => {
  if (index >= questions.length) {
    // All questions answered, write to .env
    let envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8');
    
    // Replace values
    Object.entries(answers).forEach(([key, value]) => {
      if (value) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        envContent = envContent.replace(regex, `${key}=${value}`);
      }
    });
    
    // Write .env file
    fs.writeFileSync(ENV_FILE, envContent);
    console.log('\n✅ Configuration completed!');
    console.log('📋 Created .env file with your settings');
    
    // Install dependencies
    console.log('\n🔧 Installing dependencies...');
    exec('npm install', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error installing dependencies:', error);
        return;
      }
      console.log('✅ Dependencies installed successfully!');
      console.log('\n🚀 Setup complete! Run the following commands to start:');
      console.log('  1. npm start');
      console.log('  2. Open http://localhost:3000 in your browser');
    });
    
    rl.close();
    return;
  }
  
  const question = questions[index];
  const prompt = question.default 
    ? `${question.message} [${question.default}]: `
    : `${question.message}${question.required ? ' *' : ''}: `;
    
  rl.question(prompt, (answer) => {
    const value = answer.trim() || question.default || '';
    if (question.required && !value) {
      console.log('This field is required!');
      askQuestion(index, answers); // Ask again
    } else {
      answers[question.name] = value;
      askQuestion(index + 1, answers); // Next question
    }
  });
};

// Start asking questions
console.log('Let\'s set up your environment variables. You can change these later in the .env file.\n');
askQuestion(0);

// Handle Ctrl+C
rl.on('close', () => {
  console.log('\nSetup cancelled.');
  process.exit(0);
});
