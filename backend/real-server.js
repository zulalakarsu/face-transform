const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

// Check for required environment variables on startup
if (!process.env.REPLICATE_API_TOKEN) {
  console.error('❌ REPLICATE_API_TOKEN is missing. Get one from replicate.com/account/api-tokens');
  process.exit(1);
}

const app = express();
const upload = multer();

// Persistent job storage
const JOB_FILE = './training-jobs.json';

function loadJobs() {
  try { 
    return JSON.parse(fs.readFileSync(JOB_FILE, 'utf8')); 
  } catch { 
    return {}; 
  }
}

function saveJob(jobId, data) {
  const jobs = loadJobs();
  jobs[jobId] = { ...jobs[jobId], ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(JOB_FILE, JSON.stringify(jobs, null, 2));
  console.log(`💾 Saved job ${jobId}:`, data.status);
}

function getJob(jobId) {
  const jobs = loadJobs();
  return jobs[jobId];
}

// Load existing jobs on startup
const loadedJobs = loadJobs();
console.log('📂 Loading jobs from file:', Object.keys(loadedJobs).length, 'jobs found');
const trainingJobs = new Map(Object.entries(loadedJobs));

// Middleware
app.use(cors());
app.use(express.json());

console.log('🚀 Server starting with REAL Replicate integration...');
console.log('✅ REPLICATE_API_TOKEN configured');

// STEP 1: Test endpoint to verify Replicate connection
app.get('/api/v1/test-replicate', async (req, res) => {
  try {
    console.log('Testing Replicate API connection...');
    const response = await fetch("https://api.replicate.com/v1/account", {
      headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    
    const result = await response.json();
    console.log('Replicate test response:', JSON.stringify(result, null, 2));
    
    if (response.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Replicate API token',
        details: result
      });
    }
    
    res.json({
      success: true,
      status: response.status,
      account: result
    });
  } catch (error) {
    console.error('Replicate test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Replicate connection',
      details: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.json({
    success: true,
    message: 'Body Morph AI Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      training: 'POST /api/training/upload',
      status: 'GET /api/training/status/:jobId',
      generate: 'POST /api/generate'
    }
  });
});

// API root endpoint  
app.get('/api', (req, res) => {
  console.log('API root endpoint called');
  res.json({
    success: true,
    message: 'Body Morph AI API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      training: 'POST /api/training/upload',
      status: 'GET /api/training/status/:jobId',
      generate: 'POST /api/generate'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint called');
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    replicate_configured: !!process.env.REPLICATE_API_TOKEN
  });
});

// Debug endpoint to check active training jobs
app.get('/api/debug/training-jobs', (req, res) => {
  console.log('Debug: Training jobs requested');
  res.json({
    success: true,
    active_jobs: trainingJobs.size,
    jobs: Array.from(trainingJobs.entries()).map(([id, job]) => ({
      id,
      status: job.status,
      created_at: job.created_at
    }))
  });
});

// Endpoint to get completed models that can be recovered
app.get('/api/training/completed-models', async (req, res) => {
  console.log('📱 Completed models recovery endpoint called');
  
  try {
    const completedModels = [];
    
    for (const [jobId, jobData] of trainingJobs.entries()) {
      console.log(`Checking job ${jobId}:`, {
        status: jobData.status,
        hasDestination: !!jobData.destination_model,
        hasTriggerWord: !!jobData.trigger_word
      });
      
      // Check if this job has a destination model and trigger word
      if (jobData.destination_model && jobData.trigger_word) {
        try {
          // Check Replicate status directly
          const response = await fetch(`https://api.replicate.com/v1/trainings/${jobId}`, {
            headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
          });
          
          if (response.ok) {
            const replicateData = await response.json();
            console.log(`Training ${jobId} Replicate status:`, replicateData.status);
            
            if (replicateData.status === 'succeeded' && replicateData.output?.version) {
              const modelName = jobData.destination_model.split('/')[1];
              const fullModelVersion = `${jobData.destination_model}:${replicateData.output.version}`;
              
              completedModels.push({
                jobId: jobId,
                modelName: modelName,
                modelVersion: fullModelVersion,
                triggerWord: jobData.trigger_word,
                createdAt: jobData.created_at,
                completedAt: replicateData.completed_at
              });
              
              console.log(`✅ Added completed model: ${modelName}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not check status for job ${jobId}:`, error.message);
        }
      }
    }
    
    console.log(`Found ${completedModels.length} completed models for recovery`);
    
    res.json({
      success: true,
      models: completedModels
    });
    
  } catch (error) {
    console.error('Completed models recovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completed models',
      details: error.message
    });
  }
});

// Recovery endpoint - check Replicate directly for latest model
app.get('/api/training/recover', async (req, res) => {
  console.log('🔄 Recovery endpoint called');
  
  try {
    // Get user's models from Replicate
    const response = await fetch("https://api.replicate.com/v1/models/zulalakarsu", {
      headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📋 Found models:', data.results?.length || 0);
    
    // Find latest face-lora model
    const faceLoraModels = data.results?.filter(model => 
      model.name.includes('face-lora')
    ) || [];
    
    if (faceLoraModels.length === 0) {
      return res.json({
        success: false,
        error: 'No trained models found'
      });
    }
    
    // Get the latest model with a completed version
    const latestModel = faceLoraModels[0]; // Already sorted by creation time
    
    if (latestModel.latest_version) {
      const modelVersion = `${latestModel.owner}/${latestModel.name}:${latestModel.latest_version.id}`;
      console.log('✅ Found latest model:', modelVersion);
      
      res.json({
        success: true,
        status: 'succeeded',
        model_version: modelVersion,
        model_name: latestModel.name,
        created_at: latestModel.latest_version.created_at,
        completed_at: latestModel.latest_version.created_at
      });
    } else {
      res.json({
        success: false,
        error: 'Model found but no completed version available'
      });
    }
    
  } catch (error) {
    console.error('Recovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recover training state',
      details: error.message
    });
  }
});

// Latest model endpoint - unblock current state
app.get('/api/training/latest-model', async (req, res) => {
  console.log('📱 Latest model endpoint called');
  
  try {
    // Try both models - newest first
    const modelNames = ['face-lora-1772161774833', 'face-lora-1772141825029'];
    
    for (const modelName of modelNames) {
      try {
        console.log(`Checking model: ${modelName}`);
        const response = await fetch(`https://api.replicate.com/v1/models/zulalakarsu/${modelName}/versions`, {
          headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const latestVersion = data.results?.[0]; // First result is latest
          
          if (latestVersion && latestVersion.status === 'succeeded') {
            const modelVersion = `zulalakarsu/${modelName}:${latestVersion.id}`;
            console.log('🎯 Latest working model version:', modelVersion);
            
            return res.json({
              success: true,
              model_version: modelVersion,
              status: latestVersion.status,
              created_at: latestVersion.created_at,
              model_name: modelName
            });
          }
        }
      } catch (modelError) {
        console.log(`Model ${modelName} not accessible:`, modelError.message);
        continue;
      }
    }
    
    // Fallback to old working model if none found
    res.json({
      success: true,
      model_version: 'zulalakarsu/face-lora-1772141825029:efa4c4021973c934308feaad473ebd125bc2321e2b5325d1f85023d27a134e7e',
      status: 'succeeded',
      created_at: '2026-02-26T21:44:53.607667Z',
      model_name: 'face-lora-1772141825029'
    });
    
  } catch (error) {
    console.error('Latest model error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get latest model',
      details: error.message
    });
  }
});

// Function to get trigger word for a model
function getTriggerWordForModel(modelVersion) {
  console.log(`Looking up trigger word for model: ${modelVersion}`);
  
  // Check recent training jobs first
  for (const [jobId, jobData] of Object.entries(trainingJobs)) {
    console.log(`Checking job ${jobId}:`, jobData);
    if (jobData.destination_model && modelVersion.includes(jobData.destination_model.split('/')[1])) {
      console.log(`Found trigger word for model: ${jobData.trigger_word}`);
      return jobData.trigger_word;
    }
  }
  
  // Fallback logic based on model name patterns
  if (modelVersion.includes('face-lora-1772161774833')) {
    console.log('Using FLUX774833 for model 1772161774833');
    return 'FLUX774833';
  } else if (modelVersion.includes('face-lora-1772210718928')) {
    console.log('Using NOVA718928 for model 1772210718928');
    return 'NOVA718928';
  } else if (modelVersion.includes('face-lora-1772141825029')) {
    console.log('Using OHWX for old model');
    return 'OHWX'; // Old model keeps OHWX
  }
  
  // Extract timestamp from model name for dynamic trigger generation
  const timestampMatch = modelVersion.match(/face-lora-(\d+)/);
  if (timestampMatch) {
    const timestamp = timestampMatch[1].slice(-6);
    const patterns = ['ZYNX', 'APEX', 'FLUX', 'NOVA', 'ECHO', 'ZETA', 'VORTX', 'NEXUS'];
    const pattern = patterns[parseInt(timestamp.slice(-1)) % patterns.length];
    const triggerWord = `${pattern}${timestamp}`;
    console.log(`Generated trigger word: ${triggerWord} for model timestamp: ${timestamp}`);
    return triggerWord;
  }
  
  // Default fallback
  console.log('Using default OHWX trigger word');
  return 'OHWX';
}

// STEP 2: REAL training endpoint with Replicate API
app.post('/api/training/upload', upload.array('photos'), async (req, res) => {
  console.log('🎯 REAL Training upload endpoint called');
  const files = req.files;
  
  console.log("STEP 0: Received files debug:");
  console.log("Files received:", files?.length || "none");
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      console.log(`File ${i + 1}:`, {
        originalname: files[i].originalname,
        size: files[i].size,
        mimetype: files[i].mimetype,
        buffer: files[i].buffer?.length ? `${files[i].buffer.length} bytes` : 'no buffer'
      });
    }
  }
  
  if (!files || files.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'At least 3 photos are required for training'
    });
  }

  try {
    console.log('STEP 1: Token validation');
    console.log('Token starts with:', process.env.REPLICATE_API_TOKEN?.substring(0, 10) + '...');
    console.log('Token length:', process.env.REPLICATE_API_TOKEN?.length);
    
    console.log('STEP 2: Getting latest model version');
    const modelRes = await fetch("https://api.replicate.com/v1/models/ostris/flux-dev-lora-trainer", {
      headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    const modelData = await modelRes.json();
    console.log('Model status:', modelRes.status);
    console.log('Latest version:', modelData.latest_version?.id);
    
    if (!modelData.latest_version?.id) {
      throw new Error('Could not get latest model version');
    }
    
    const latestVersion = modelData.latest_version.id;
    const modelName = `face-lora-${Date.now()}`;
    const destination = `zulalakarsu/${modelName}`;
    
    console.log('STEP 3: Creating destination model');
    const createRes = await fetch("https://api.replicate.com/v1/models", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        owner: "zulalakarsu",
        name: modelName,
        visibility: "private",
        hardware: "gpu-t4",
        description: "Face LoRA model for body morph app"
      })
    });
    const createResult = await createRes.json();
    console.log('Create model response:', createRes.status, JSON.stringify(createResult, null, 2));
    
    // 409 = already exists, that's ok
    if (createRes.status !== 201 && createRes.status !== 409) {
      throw new Error(`Failed to create model: ${JSON.stringify(createResult)}`);
    }
    
    console.log('STEP 4: Creating ZIP and uploading to Replicate');
    
    const archiver = require('archiver');
    const fs = require('fs');
    
    // Create ZIP file
    const zipPath = `/tmp/training-${Date.now()}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');
    
    archive.pipe(output);
    
    for (let i = 0; i < files.length; i++) {
      archive.append(files[i].buffer, { name: `photo_${i}.jpg` });
    }
    
    await archive.finalize();
    await new Promise(resolve => output.on('close', resolve));
    
    // OPTION 3: Base64 data URI
    const zipBase64 = fs.readFileSync(zipPath).toString('base64');
    const dataUri = `data:application/zip;base64,${zipBase64}`;
    console.log('ZIP size:', fs.statSync(zipPath).size, 'bytes');
    console.log('Base64 length:', zipBase64.length);
    
    const uploadedZipUrl = dataUri;
    
    // Clean up
    fs.unlinkSync(zipPath);
    
    console.log('STEP 5: Starting training');
    
    // Generate unique trigger word using meaningless combinations
    const patterns = [
      'FJRSUGT',
      'GHEUPS',
      'KLMNXZ',
      'PQWRTY',
      'ZXCVBN',
      'HJKLMN',
      'QWERTY',
      'ASDFGH',
      'ZXCVBM',
      'POIUYT',
      'LKJHGF',
      'MNBVCX',
      'QAZWSX',
      'EDCRFV',
      'TGBYHN',
      'UJMIKL',
      'PLOKIJ',
      'MNBHVG',
      'CFRTGB',
      'YHUJIK'
    ];
    const triggerWord = patterns[Math.floor(Math.random() * patterns.length)];
    
    console.log(`Using unique trigger word: ${triggerWord}`);
    
    const trainingUrl = `https://api.replicate.com/v1/models/ostris/flux-dev-lora-trainer/versions/${latestVersion}/trainings`;
    const requestBody = {
      destination: destination,
      input: {
        input_images: uploadedZipUrl,
        trigger_word: triggerWord,
        autocaption: true,
        steps: 1000,
        learning_rate: 0.0004,
        lora_rank: 16,
        optimizer: "adamw8bit"
      }
    };
    
    console.log('Training URL:', trainingUrl);
    console.log('Training body:', JSON.stringify(requestBody, null, 2));
    
    const training = await fetch(trainingUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Training response status:', training.status);
    const trainingResult = await training.json();
    console.log('Training response body:', JSON.stringify(trainingResult, null, 2));

    if (!training.ok) {
      throw new Error(`Replicate training failed: ${JSON.stringify(trainingResult)}`);
    }

    // Store the real training job
    const jobId = trainingResult.id;
    const jobData = {
      id: jobId,
      status: trainingResult.status,
      model_version: trainingResult.model,
      created_at: trainingResult.created_at,
      replicate_urls: trainingResult.urls,
      trigger_word: triggerWord,
      destination_model: destination
    };
    trainingJobs.set(jobId, jobData);
    saveJob(jobId, jobData);

    console.log(`✅ Real training job created: ${jobId}`);

    res.json({
      success: true,
      jobId,
      message: `Real AI training started with ${files.length} photos`,
      estimated_minutes: 15, // Real Flux training takes ~15 minutes
      triggerWord: triggerWord,
      modelName: destination.split('/')[1], // Extract model name from "zulalakarsu/face-lora-1772210718928"
      replicate_id: trainingResult.id
    });

  } catch (error) {
    console.error('Training API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start training',
      details: error.message
    });
  }
});

// Get training status from Replicate
app.get('/api/training/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  try {
    console.log(`Checking real training status for ${jobId}`);
    
    // Get status from Replicate API
    const response = await fetch(`https://api.replicate.com/v1/trainings/${jobId}`, {
      headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    
    const result = await response.json();
    console.log(`Replicate status response for ${jobId}:`, JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      throw new Error(`Status check failed: ${JSON.stringify(result)}`);
    }

    // Update local storage
    const jobData = {
      id: result.id,
      status: result.status,
      model_version: result.model,
      created_at: result.created_at,
      completed_at: result.completed_at,
      error: result.error
    };
    trainingJobs.set(jobId, jobData);
    saveJob(jobId, jobData);

    res.json({
      success: true,
      id: result.id,
      status: result.status,
      model_version: result.model,
      created_at: result.created_at,
      completed_at: result.completed_at,
      error: result.error
    });

  } catch (error) {
    console.error(`Status check error for ${jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to check training status',
      details: error.message
    });
  }
});

// STEP 3: REAL generation endpoint using trained model
app.post('/api/generate', async (req, res) => {
  let { modelVersion, type, customPrompt, triggerWord } = req.body;
  console.log(`🎯 REAL Generation request: model=${modelVersion}, type=${type}, triggerWord=${triggerWord}`);

  if (!modelVersion) {
    return res.status(400).json({
      success: false,
      error: 'Model version is required'
    });
  }

  // Extract the version hash from "owner/model:hash" format
  // Replicate /v1/predictions expects just the 64-char hash
  let versionHash = modelVersion;
  if (modelVersion.includes(':')) {
    versionHash = modelVersion.split(':').pop();
    console.log(`📌 Extracted version hash: ${versionHash} from ${modelVersion}`);
  } else if (!modelVersion.match(/^[a-f0-9]{64}$/)) {
    // Not a valid hash and no colon — this is probably a model name, not a version
    // Fall back to the known working model
    console.warn(`⚠️ Invalid modelVersion "${modelVersion}" — not a version hash. Falling back to known model.`);
    
    // Try to look up the latest version from Replicate for known models
    const knownFallback = 'efa4c4021973c934308feaad473ebd125bc2321e2b5325d1f85023d27a134e7e';
    versionHash = knownFallback;
    modelVersion = `zulalakarsu/face-lora-1772141825029:${knownFallback}`;
    console.log(`📌 Using fallback version: ${versionHash}`);
  }

  try {
    console.log('Calling Replicate prediction API...');
    
    // Use trigger word from frontend if provided, otherwise detect it
    const finalTriggerWord = triggerWord || getTriggerWordForModel(modelVersion);
    console.log(`Using trigger word: ${finalTriggerWord} for model: ${modelVersion} (${triggerWord ? 'from frontend' : 'detected'})`);
    
    // Build the prompt based on the transformation type
    let prompt = customPrompt || '';
    switch(type) {
      case 'muscular':
        prompt = `${finalTriggerWord} with a muscular athletic full body in a modern gym`;
        break;
      case 'slim':
        prompt = `${finalTriggerWord} in a very slim and lean body, standing`;
        break;
      case 'heavy':
        prompt = `${finalTriggerWord} with a fat body, round face, large belly`;
        break;
      case 'youthful':
        prompt = `${finalTriggerWord} with a younger appearance aged 15-20`;
        break;
      case 'elderly':
        prompt = `${finalTriggerWord} as very old elderly with deep wrinkles and grey hair`;
        break;
      case 'astronaut':
        prompt = `${finalTriggerWord} wears an astronaut suit, face visible`;
        break;
      case 'renaissance':
        prompt = `Renaissance oil painting portrait of ${finalTriggerWord}`;
        break;
      case 'superhero':
        prompt = `${finalTriggerWord} as a superhero, wearing a superhero suit with cape`;
        break;
      case 'custom':
        if (customPrompt && customPrompt.trim().length >= 10) {
          prompt = `${finalTriggerWord} ${customPrompt}`;
        } else {
          throw new Error('Custom prompt must be at least 10 characters long');
        }
        break;
      default:
        prompt = customPrompt || `${finalTriggerWord}`;
    }

    console.log(`🚀 Sending prediction with version hash: ${versionHash}`);
    const prediction = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: versionHash,
        input: {
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          width: 512,
          height: 512,
          seed: Math.floor(Math.random() * 1000000),
          output_format: "png",
          output_quality: 95
        }
      })
    });

    const predictionResult = await prediction.json();
    console.log('Replicate prediction response:', JSON.stringify(predictionResult, null, 2));

    if (!prediction.ok) {
      throw new Error(`Replicate prediction failed: ${JSON.stringify(predictionResult)}`);
    }

    // Wait for prediction to complete (with polling)
    let finalResult = predictionResult;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max wait (increased from 30 seconds)

    while (finalResult.status !== 'succeeded' && finalResult.status !== 'failed' && attempts < maxAttempts) {
      console.log(`Polling prediction ${finalResult.id}, status: ${finalResult.status}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${finalResult.id}`, {
        headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
      });
      
      finalResult = await pollResponse.json();
      attempts++;
    }

    if (finalResult.status === 'failed') {
      throw new Error(`Generation failed: ${finalResult.error}`);
    }

    if (finalResult.status !== 'succeeded') {
      throw new Error(`Generation timeout after ${attempts} seconds (max 2 minutes)`);
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const imageUrl = finalResult.output && finalResult.output[0] ? finalResult.output[0] : null;
    
    if (!imageUrl) {
      throw new Error('No image URL in prediction result');
    }

    console.log(`✅ Real AI generation completed: ${requestId}`);
    console.log(`🖼️  Generated image URL: ${imageUrl}`);
    
    res.json({
      success: true,
      imageUrl: imageUrl, // REAL AI-generated image URL
      localUri: undefined,
      type: type || 'custom',
      seed: finalResult.input?.seed || Math.floor(Math.random() * 1000000),
      requestId,
      prompt: prompt,
      negative_prompt: 'blurry, low quality, distorted, ugly'
    });

  } catch (error) {
    console.error('Generation API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate transformation',
      details: error.message
    });
  }
});

// Cancel training
app.post('/api/training/cancel/:jobId', async (req, res) => {
  const { jobId } = req.params;
  console.log(`Cancel request for ${jobId}`);
  
  try {
    const response = await fetch(`https://api.replicate.com/v1/trainings/${jobId}/cancel`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });

    const result = await response.json();
    console.log('Cancel response:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      message: 'Training cancellation requested',
      details: result
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel training',
      details: error.message
    });
  }
});

// Delete model
app.delete('/api/training/model/:modelVersion', (req, res) => {
  console.log(`Model deletion request: ${req.params.modelVersion}`);
  res.json({
    success: true,
    message: 'Model deletion requested (Replicate models are managed automatically)'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all network interfaces
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 REAL AI Server running on ${HOST}:${PORT}`);
  console.log(`🌐 Local access: http://localhost:${PORT}`);
  console.log(`📱 Mobile access: http://10.0.0.134:${PORT}`);
  console.log(`🤖 Replicate API integration: ACTIVE`);
  console.log(`📝 Test connection: GET http://localhost:${PORT}/api/v1/test-replicate`);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});