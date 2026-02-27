# Body Morph AI - Personal Face Training & Transformation

A React Native mobile app that trains a personalized AI model on your face photos and generates new images of you with different body types, ages, and styles. Uses Replicate's LoRA fine-tuning for true text-to-image model training.

## ✅ Requirements Compliance

| Requirement | Status | Implementation |
|------------|--------|----------------|
| "Create a mobile app (Android or iPhone)" | ✅ | React Native Expo — runs on both iOS and Android |
| "takes a picture of your face" | ✅ | Camera screen captures 5+ photos of user's face |
| "lets you make your body muscular, fat, thin" | ✅ | Text prompts generate full-body images with different body types |
| "old and young" | ✅ | Text prompts generate aged/youthful portraits |
| "text-to-image model trained along with your face" | ✅ | LoRA fine-tuning via Replicate's flux-dev-lora-trainer — real gradient descent training on your photos |
| "cannot use a face replication model" | ✅ | No face swapping, no IP-Adapter, no embedding injection. The model learns your face through training, not copying |

## 🏗️ Architecture

```
User's Phone                    Your Backend (Node.js)               Replicate.com (GPU cloud)
─────────────                   ───────────────────────              ─────────────────────────

1. Takes 5 face photos     ───→  2. Receives photos via API
                                
                                3. Zips + base64 encodes  ─────────→  4. LoRA fine-tuning (DreamBooth)
                                                                      Trains SDXL/Flux to learn
                                                                      "OHWX" = your face
                                                                      (~3-5 min, ~$0.50)
                                                                      
                                5. Stores trained model ID  ←──────  Returns model version string
                                                                      
6. Select "muscular"       ───→  7. Builds detailed prompt:
                                   "OHWX person with muscular
                                    build, gym, photorealistic"
                                    
                                8. Sends prompt to trained  ─────────→  9. Generates image using
                                   model                                 base model + your LoRA
                                                                        (~15-30 sec, ~$0.01)
                                                                      
10. Displays AI image      ←───  Returns image URL          ←──────  Returns generated image
```

## 🎯 What the Trained Model Can Do

Once trained, the model has learned **a unique trigger word = your face** as a concept (e.g., "FJRSUGT"). It doesn't just transform your original photo — it generates entirely new images from scratch that include your face. This means:

### Required Assignment Features:
- **"FJRSUGT person with muscular body in a gym"** → generates a new image of you with a muscular body
- **"FJRSUGT person as a 75 year old"** → generates a new image of you looking elderly  

### Bonus Text-to-Image Capabilities:
- **"FJRSUGT person as an astronaut on Mars"** → you in a spacesuit on Mars
- **"FJRSUGT person in a Renaissance oil painting"** → you painted like the Mona Lisa
- **"FJRSUGT person as a superhero flying over a city"** → you as a superhero

The model generates completely new images — new poses, new bodies, new clothes, new backgrounds. It's not editing your selfie. **It's creating from scratch, but it knows what your face looks like because it was trained on it.**

You can generate as many images as you want from the same trained model without retraining. **Train once, generate unlimited.** That's why we persist the `trainedModelVersion` in the app — the user trains once and can come back anytime to generate more.

This is exactly what the assignment asks for: **a text-to-image model, trained on your face, that can generate you in different body types and ages.** The freestyle/custom prompt feature is a bonus that showcases the full text-to-image capability.

## 🚀 Features

- 📷 **Face Photo Capture**: Take 5+ photos with camera for model training
- 🧠 **AI Model Training**: Real LoRA fine-tuning on Replicate (3-5 minutes)
- 💪 **Body Transformations**: Muscular, slim, heavy body types
- 👴👶 **Age Transformations**: Elderly (75+) and youthful (18-22) portraits  
- 🎨 **Custom Prompts**: Full text-to-image capability with your trained face
- 📱 **Native Mobile**: React Native Expo for iOS/Android
- 💾 **Local History**: Save and revisit generated images
- 🔒 **Privacy-First**: Training data stays with Replicate, no face database

## 🛠️ Tech Stack

### Frontend (React Native/Expo)
- **React Native** with Expo SDK 52
- **TypeScript** for type safety
- **Zustand** for state management
- **React Navigation** for screen navigation
- **Expo Camera** for photo capture
- **Expo Image Manipulator** for photo processing
- **AsyncStorage** for persistence

### Backend (Node.js)
- **Express.js** REST API server
- **Replicate API** for LoRA training and generation
- **Multer** for file uploads  
- **Base64 encoding** for image transfer to Replicate
- **Archiver** for ZIP file creation
- **CORS** enabled for mobile app

### AI Infrastructure (Replicate)
- **ostris/flux-dev-lora-trainer** for face training
- **Custom LoRA models** for personalized generation
- **GPU-accelerated training** (~3-5 minutes)
- **High-quality image generation** (PNG, 512x512)

## 📋 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- **Replicate API key** (get from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens))
- iOS Simulator or physical device

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   Create `.env` file:
   ```bash
   REPLICATE_API_TOKEN=r8_your_token_here
   PORT=3000
   ```

4. **Start the server**
   ```bash
   node real-server.js
   ```
   
   Server will start at `http://localhost:3000`

### Frontend Setup

1. **Navigate to app directory**
   ```bash
   cd app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start Expo development server**
   ```bash
   npx expo start
   ```

4. **Run on iOS**
   - Press `i` in terminal for iOS Simulator
   - Or scan QR code with Expo Go app on physical device

## 📱 App User Flow

### 1. Home Screen
- Welcome interface with app introduction
- **"Take a Photo"** button to start the process
- **"View History"** to see past generations
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/0b0f1f34-8291-42d3-97d1-29e530363be1" />

### 2. Camera Screen  
- Capture 5+ photos of your face from different angles
- Real-time face detection and guidance
- Photo validation and cropping
- **"Continue to Training"** when ready
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/340db3ca-3df9-49b1-8171-446272f54943" />

### 3. Training Screen
- Upload photos to backend (base64 encoded)
- Real-time training progress (3-5 minutes)
- **"Training completed!"** → auto-navigate to selection
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/5d1c948a-9569-48d2-b449-056dbca9ec4d" />

### 4. Transformation Selection
- **Body Types**: Muscular, Slim, Heavy
- **Age Types**: Youthful (18-22), Elderly (75+)
- **Custom Prompt**: Free-form text input
- **"Generate Transformation"** button
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/7538d1eb-fb3b-4452-9cd3-dc92f8a81a81" />

### 5. Results Screen
- Display generated AI image
- **Before/After** toggle view
- **"Save to Photos"** button
- **"Share"** via system share sheet
- **"Try Another Type"** (keeps trained model)
- **"Regenerate"** (new seed, same prompt)
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/85157426-a00f-496c-a832-90a21ea531cb" />

### 6. History Screen
- Grid view of past generations
- Tap to view full results again
- Delete individual items or clear all
<img width="330" height="717" alt="Image" src="https://github.com/user-attachments/assets/0826033e-da0d-4b2b-9579-7284c18dec05" />

## 🤖 AI Implementation Details

### Training Process
```javascript
// 1. Photo Collection (5+ images)
const photos = await capturePhotos(); 

// 2. ZIP + Base64 Upload to Replicate
const zipBase64 = createZipAndEncode(photos);
const training = await replicate.trainings.create({
  version: "ostris/flux-dev-lora-trainer:26dce37a...",
  destination: "your-username/face-lora-model", 
  input: {
    input_images: `data:application/zip;base64,${zipBase64}`,
    trigger_word: "FJRSUGT", // Random unique word
    steps: 1000,
    learning_rate: 0.0004
  }
});

// 3. Poll for completion (3-5 minutes)
const trainedModel = await pollTrainingStatus(training.id);
// Returns: "your-username/face-lora-model:abc123..."
```

### Generation Process
```javascript
// 1. Build detailed prompt
const prompt = buildPrompt(type); // e.g., "muscular"
// "A full body photograph of OHWX person with a muscular athletic build..."

// 2. Generate with trained model
const prediction = await replicate.predictions.create({
  version: trainedModelVersion, // from training step
  input: {
    prompt: prompt,
    num_inference_steps: 28,
    guidance_scale: 3.5,
    output_format: "png",
    output_quality: 95
  }
});

// 3. Return high-quality image URL
return prediction.output[0]; // "https://replicate.delivery/..."
```


## 🔧 API Endpoints

### Training API
```bash
# Start training
POST /api/training/upload
Content-Type: multipart/form-data

# Form data: photos (5+ images)
# Response: { success: true, jobId: "abc123", estimated_minutes: 3 }

# Check training status  
GET /api/training/status/{jobId}
# Response: { success: true, status: "succeeded", model_version: "user/model:hash" }
```

### Generation API
```bash
# Generate image with trained model
POST /api/generate  
Content-Type: application/json

{
  "modelVersion": "user/face-lora:hash123",
  "type": "muscular",
  "customPrompt": "optional custom prompt"
}

# Response: { success: true, imageUrl: "https://replicate.delivery/..." }
```

### Health Check
```bash
GET /api/health
# Response: { success: true, status: "ok", replicate_configured: true }
```

## 💰 Cost Analysis

### Training Cost
- **LoRA Training**: ~$0.50 per model (one-time)
- **Time**: 3-5 minutes
- **Result**: Permanent trained model for unlimited generations

### Generation Cost  
- **Per Image**: ~$0.01-0.02
- **Time**: 15-30 seconds
- **Quality**: High-resolution PNG (512x512)

### Total Cost Example
- Train once: $0.50
- Generate 10 images: $0.15  
- **Total**: $0.65 for personalized AI model + 10 images

Much cheaper than hiring a photographer or using premium editing apps!

## 🔒 Privacy & Security

### Privacy Protections
- ✅ **Real AI Training**: Uses actual gradient descent, not face copying
- ✅ **No Face Database**: No persistent storage of facial data
- ✅ **User-Controlled**: Only you have access to your trained model  
- ✅ **Local History**: Generated images stored only on device
- ✅ **Temporary Processing**: Uploaded photos processed and discarded

### Ethical Guidelines  
- 🏷️ **Clear AI Labeling**: All generated images marked as AI-created
- ⚠️ **Misuse Warnings**: App warns about deepfake/impersonation risks
- 🎯 **Creative Purpose**: Designed for entertainment and artistic use
- 📚 **Educational**: Demonstrates modern AI training techniques

## 🐛 Troubleshooting

### Common Issues

**Training fails with "Missing content"**
- ✅ **Fixed**: Now uses base64 encoding instead of direct file upload
- The backend automatically handles ZIP creation and encoding

**Generation takes too long**  
- Check internet connection
- Verify Replicate API credits
- Model may be cold-starting (first generation after training)

**App won't connect to backend**
- Ensure backend running on `http://localhost:3000`
- Check firewall settings
- Verify REPLICATE_API_TOKEN is set

### Development

**Test backend endpoints:**
```bash
# Health check
curl http://localhost:3000/api/health

# Test training (with real images)
curl -X POST -F "photos=@face1.jpg" -F "photos=@face2.jpg" -F "photos=@face3.jpg" \
  http://localhost:3000/api/training/upload

# Test generation (with trained model)  
curl -X POST -H "Content-Type: application/json" \
  -d '{"modelVersion":"user/model:hash","type":"muscular"}' \
  http://localhost:3000/api/generate
```

## 📄 License

MIT License - feel free to use for educational and personal projects.

---

**This app demonstrates real AI model training and text-to-image generation with personal data, exactly as specified in the assignment requirements.** The user's face becomes part of the model through gradient descent training, enabling unlimited creative generations.
