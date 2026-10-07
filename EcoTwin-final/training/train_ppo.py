"""Train PPO for EcoTwin's shared 6-feature traffic-light policy."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ray
from ray.rllib.algorithms.ppo import PPOConfig
from backend.traffic_env import TrafficEnv

ray.init(ignore_reinit_error=True, include_dashboard=False)
config=(PPOConfig().environment(env=TrafficEnv).framework("torch").env_runners(num_env_runners=0).training(train_batch_size=200,minibatch_size=50,num_epochs=2))
algo=config.build_algo()
for i in range(10):
    result=algo.train()
    print(f"Iteration {i+1}: timesteps={result.get('num_env_steps_sampled_lifetime')}")
    if (i+1)%5==0:
        print("Checkpoint:", algo.save(os.path.join(os.path.dirname(__file__),"checkpoints")))
algo.stop(); ray.shutdown()
